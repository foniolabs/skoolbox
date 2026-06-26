#!/usr/bin/env python3
"""Query the SkoolBox RAG index to verify retrieval before shipping.

Mirrors the app's retrieval (src-tauri/src/ai/rag.rs): builds a safe FTS5 MATCH
expression, then applies the retrieval strategy from the student's class
metadata.json (docs/CURRICULUM_ARCHITECTURE.md §4):

  - standard   : own class only                       (non-exam classes)
  - tiered     : own 0.70 / prerequisites 0.25 / exam 0.05   (exam classes)
  - remediation: own 0.20 / prerequisites 0.75 / exam 0.05   (student struggling)
  - revision   : own 0.40 / prerequisites 0.40 / exam 0.20   (exam practice)

Each tier is a separate FTS query; results are merged by (relevance x tier
weight) and the top N chunks are returned, exactly as the app will assemble
context for the LLM.

Usage:
    python rag/query.py -c nigerian -s mathematics -l jss3 "solve for x"
    python rag/query.py -c nigerian -s mathematics -l jss3 --mode remediation "solve for x"
    python rag/query.py --stats
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TOKEN_RE = re.compile(r"[^0-9A-Za-z]+")

# Mode weights (kept in sync with skoolbox-config.json -> rag.retrieval_modes).
MODE_WEIGHTS = {
    "standard":    {"own_class": 1.00, "prerequisites": 0.00, "exam_bank": 0.00},
    "tiered":      {"own_class": 0.70, "prerequisites": 0.25, "exam_bank": 0.05},
    "remediation": {"own_class": 0.20, "prerequisites": 0.75, "exam_bank": 0.05},
    "revision":    {"own_class": 0.40, "prerequisites": 0.40, "exam_bank": 0.20},
}


def to_fts_match(query: str) -> str | None:
    terms = [f'"{t.lower()}"' for t in TOKEN_RE.split(query) if len(t) > 2]
    return " OR ".join(terms) if terms else None


def load_class_meta(curriculum: str, subject: str, class_level: str) -> dict | None:
    """Find the metadata.json for a class (phase folder name is not needed)."""
    croot = REPO / "dataset" / curriculum / subject
    for meta_path in croot.glob(f"*/{class_level}/metadata.json"):
        return json.loads(meta_path.read_text(encoding="utf-8"))
    return None


def tier_query(conn, match, curriculum, subject, levels, exam_only, limit):
    """One FTS query over a set of class levels. Returns [(relevance, row)]."""
    if not levels and not exam_only:
        return []
    placeholders = ",".join("?" for _ in levels) or "''"
    exam_clause = "AND is_exam_bank = '1'" if exam_only else "AND is_exam_bank = '0'"
    level_clause = (f"AND class_level IN ({placeholders})" if levels else "")
    sql = (
        "SELECT -bm25(curriculum_fts) AS relevance, content, title, "
        "       class_level, source_type "
        "FROM curriculum_fts "
        "WHERE curriculum_fts MATCH ? "
        "  AND curriculum = ? AND subject = ? "
        f"  {level_clause} {exam_clause} "
        "ORDER BY rank LIMIT ?"
    )
    params = [match, curriculum, subject, *levels, limit]
    return [(r[0], r[1:]) for r in conn.execute(sql, params).fetchall()]


def retrieve(conn, match, curriculum, subject, class_level, meta, mode, limit):
    """Run every weighted tier and merge by (relevance x weight)."""
    weights = MODE_WEIGHTS[mode]
    prereqs = meta.get("prerequisite_levels", []) if meta else []
    pool = limit * 3  # over-fetch per tier, then merge

    scored: list[tuple[float, tuple]] = []
    if weights["own_class"] > 0:
        for rel, row in tier_query(conn, match, curriculum, subject,
                                   [class_level], False, pool):
            scored.append((rel * weights["own_class"], row))
    if weights["prerequisites"] > 0 and prereqs:
        for rel, row in tier_query(conn, match, curriculum, subject,
                                   prereqs, False, pool):
            scored.append((rel * weights["prerequisites"], row))
    if weights["exam_bank"] > 0:
        for rel, row in tier_query(conn, match, curriculum, subject,
                                   [class_level, *prereqs], True, pool):
            scored.append((rel * weights["exam_bank"], row))

    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[:limit]


def show_stats(conn: sqlite3.Connection) -> int:
    rows = conn.execute(
        "SELECT curriculum, subject, class_level, "
        "       SUM(CASE WHEN is_exam_bank=1 THEN 1 ELSE 0 END) AS exam, "
        "       COUNT(*), SUM(chunk_count) "
        "FROM curriculum_documents "
        "GROUP BY curriculum, subject, class_level ORDER BY 1,2,3"
    ).fetchall()
    if not rows:
        print("Index is empty. Run rag/ingest.py first.")
        return 0
    print(f"{'CURRIC':<10}{'SUBJECT':<14}{'LEVEL':<9}{'EXAM':>5}{'DOCS':>6}{'CHUNKS':>8}")
    for cur, subj, lvl, exam, ndocs, nch in rows:
        print(f"{cur or '-':<10}{subj or '-':<14}{lvl or '-':<9}"
              f"{exam or 0:>5}{ndocs:>6}{(nch or 0):>8}")
    tot_d = conn.execute("SELECT COUNT(*) FROM curriculum_documents").fetchone()[0]
    tot_c = conn.execute("SELECT COUNT(*) FROM curriculum_fts").fetchone()[0]
    print(f"\nTotal: {tot_d} documents, {tot_c} chunks.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Query / inspect the RAG index.")
    ap.add_argument("question", nargs="?", default="", help="The query text")
    ap.add_argument("--db", default=str(REPO / "src-tauri" / "curriculum.db"))
    ap.add_argument("-c", "--curriculum", default="nigerian")
    ap.add_argument("-s", "--subject", default="")
    ap.add_argument("-l", "--class-level", default="")
    ap.add_argument("--mode", choices=list(MODE_WEIGHTS),
                    help="Override the retrieval mode from metadata.json")
    ap.add_argument("-n", "--limit", type=int, default=4, help="Max passages (app uses 4)")
    ap.add_argument("--stats", action="store_true", help="Show index contents and exit")
    args = ap.parse_args()

    if not Path(args.db).exists():
        print(f"error: database not found: {args.db}", file=sys.stderr)
        return 1
    conn = sqlite3.connect(args.db)

    if args.stats:
        return show_stats(conn)
    if not (args.question and args.subject and args.class_level):
        print("error: need a question plus -s SUBJECT and -l CLASS (or --stats)",
              file=sys.stderr)
        return 1

    match = to_fts_match(args.question)
    if match is None:
        print("No searchable terms (need words longer than 2 letters).")
        return 0

    meta = load_class_meta(args.curriculum, args.subject, args.class_level)
    mode = args.mode or (meta.get("retrieval_mode", "standard") if meta else "standard")
    if meta is None:
        print(f"note: no metadata.json for {args.curriculum}/{args.subject}/"
              f"{args.class_level}; using mode '{mode}' with no prerequisites.")

    results = retrieve(conn, match, args.curriculum, args.subject,
                       args.class_level, meta, mode, args.limit)
    if not results:
        print("No matching passages. (Check filters and that content was ingested.)")
        return 0

    print(f"Top {len(results)} passage(s) — mode={mode} — for: {args.question!r}\n")
    for i, (score, (content, title, lvl, source_type)) in enumerate(results, 1):
        snippet = content if len(content) <= 300 else content[:300] + "…"
        print(f"[{i}] {source_type} — {lvl} — {title}  (score {score:.3f})\n{snippet}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
