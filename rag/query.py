#!/usr/bin/env python3
"""Query the SkoolBox RAG index to verify retrieval before shipping.

Mirrors the app's retrieval (src-tauri/src/ai/rag.rs::search_curriculum): builds a
safe FTS5 MATCH expression from the question, filters by subject / class level,
and ranks by BM25. Use it after rag/ingest.py to sanity-check that real questions
return the right passages.

Usage:
    python rag/query.py --db src-tauri/curriculum.db "How do I add fractions?"
    python rag/query.py --db src-tauri/curriculum.db -s Mathematics -l JSS2 "add fractions"
    python rag/query.py --db src-tauri/curriculum.db --stats
"""
from __future__ import annotations

import argparse
import re
import sqlite3
import sys
from pathlib import Path

TOKEN_RE = re.compile(r"[^0-9A-Za-z]+")


def to_fts_match(query: str) -> str | None:
    """Turn free text into a safe FTS5 MATCH expr (mirrors rag.rs::to_fts_match).

    Keep alphanumeric tokens longer than 2 chars, quote each, OR them together.
    """
    terms = [f'"{t.lower()}"' for t in TOKEN_RE.split(query) if len(t) > 2]
    return " OR ".join(terms) if terms else None


def show_stats(conn: sqlite3.Connection) -> int:
    rows = conn.execute(
        "SELECT subject, class_level, source_type, COUNT(*) , SUM(chunk_count) "
        "FROM curriculum_documents GROUP BY subject, class_level, source_type "
        "ORDER BY subject, class_level"
    ).fetchall()
    if not rows:
        print("Index is empty. Run rag/ingest.py first.")
        return 0
    total_docs = conn.execute("SELECT COUNT(*) FROM curriculum_documents").fetchone()[0]
    total_chunks = conn.execute("SELECT COUNT(*) FROM curriculum_fts").fetchone()[0]
    print(f"{'SUBJECT':<14}{'LEVEL':<8}{'SOURCE':<16}{'DOCS':>5}{'CHUNKS':>8}")
    for subj, lvl, src, ndocs, nchunks in rows:
        print(f"{subj or '-':<14}{lvl or '-':<8}{src or '-':<16}{ndocs:>5}{(nchunks or 0):>8}")
    print(f"\nTotal: {total_docs} documents, {total_chunks} chunks.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Query / inspect the RAG index.")
    ap.add_argument("question", nargs="?", default="", help="The query text")
    ap.add_argument("--db", default="src-tauri/curriculum.db", help="SQLite database")
    ap.add_argument("-s", "--subject", default="", help="Filter by subject")
    ap.add_argument("-l", "--class-level", default="", help="Filter by class level")
    ap.add_argument("-n", "--limit", type=int, default=4, help="Max passages (app uses 4)")
    ap.add_argument("--stats", action="store_true", help="Show what's in the index and exit")
    args = ap.parse_args()

    if not Path(args.db).exists():
        print(f"error: database not found: {args.db}", file=sys.stderr)
        return 1
    conn = sqlite3.connect(args.db)

    if args.stats:
        return show_stats(conn)
    if not args.question:
        print("error: provide a question, or use --stats", file=sys.stderr)
        return 1

    match = to_fts_match(args.question)
    if match is None:
        print("No searchable terms (need words longer than 2 letters).")
        return 0

    rows = conn.execute(
        """SELECT content, title, source_type FROM curriculum_fts
           WHERE curriculum_fts MATCH ?
             AND (? = '' OR subject = ? OR subject IS NULL)
             AND (? = '' OR class_level = ? OR class_level IS NULL)
           ORDER BY rank LIMIT ?""",
        (match, args.subject, args.subject,
         args.class_level, args.class_level, args.limit),
    ).fetchall()

    if not rows:
        print("No matching passages. (Check subject/level filters and that the "
              "topic was ingested.)")
        return 0
    print(f"Top {len(rows)} passage(s) for: {args.question!r}\n")
    for i, (content, title, source_type) in enumerate(rows, 1):
        snippet = content if len(content) <= 300 else content[:300] + "…"
        print(f"[{i}] {source_type} — {title}\n{snippet}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
