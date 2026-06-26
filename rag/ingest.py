#!/usr/bin/env python3
"""Ingest curriculum knowledge into the SkoolBox RAG index.

Walks the dataset hierarchy described in docs/CURRICULUM_ARCHITECTURE.md:

    dataset/<curriculum>/<subject>/<phase>/<class>/
        metadata.json                  <- required "contract" (or folder is skipped)
        <topic>.jsonl                  <- tutoring Q&A (becomes retrievable knowledge)
        <exam_body>_past_questions.jsonl  <- exam bank (is_exam_bank = 1)

Each .jsonl line is a chat example {"messages": [system, user, assistant]} (or a
{"question","answer"} pair). We index the assistant/answer text — that is the
curriculum knowledge a student should retrieve — tagged with the full metadata
the retrieval filter queries against.

The index is SQLite FTS5 (see the engine note in skoolbox-config.json): a single
bundled file with zero extra runtime dependencies, which matters for an offline
app. The schema mirrors production (src-tauri/src/db/connection.rs) so the db this
produces is a drop-in for the Tauri app, and rag/query.py reads it back to verify.

Usage:
    python rag/ingest.py                                  # all curricula in dataset/
    python rag/ingest.py --curriculum nigerian --reset
    python rag/ingest.py --db src-tauri/curriculum.db
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import uuid
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Chunking guidelines (doc §5.3). Tutoring answers are short, so most become a
# single chunk; long passages are split with overlap to preserve worked examples.
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 150
SOURCE_TYPES = ("textbook", "curriculum", "past_questions", "lesson_notes", "tutor_qa")


def chunk_text(text: str) -> list[str]:
    text = " ".join(text.split())
    if not text:
        return []
    chunks, start = [], 0
    while start < len(text):
        end = min(start + CHUNK_CHARS, len(text))
        if end < len(text):
            dot = text.rfind(". ", start + CHUNK_CHARS // 2, end)
            if dot != -1:
                end = dot + 1
        chunks.append(text[start:end].strip())
        start = end - CHUNK_OVERLAP if end < len(text) else end
    return [c for c in chunks if c]


def ensure_schema(conn: sqlite3.Connection) -> None:
    """Create the exact production schema (connection.rs) if missing."""
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS curriculum_documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            curriculum TEXT,
            subject TEXT,
            class_level TEXT,
            topic TEXT,
            source_type TEXT NOT NULL DEFAULT 'textbook',
            source_file TEXT,
            is_exam_bank INTEGER NOT NULL DEFAULT 0,
            chunk_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS curriculum_fts USING fts5(
            content,
            title UNINDEXED,
            curriculum UNINDEXED,
            subject UNINDEXED,
            class_level UNINDEXED,
            topic UNINDEXED,
            source_type UNINDEXED,
            is_exam_bank UNINDEXED,
            document_id UNINDEXED,
            tokenize = 'porter unicode61'
        );
        """
    )


def extract_records(path: Path) -> list[tuple[str, str]]:
    """Return (title, text) units from one .jsonl file.

    Supports the chat format {"messages":[...]} and the {"question","answer"}
    format. The retrievable text is the assistant/answer; the user/question (if
    present) is folded in so the student's phrasing is searchable too.
    """
    out: list[tuple[str, str]] = []
    for ln, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            print(f"  ! {path.name}:{ln} invalid JSON ({e}); skipped", file=sys.stderr)
            continue
        question = answer = ""
        if "messages" in obj:
            for m in obj["messages"]:
                if m.get("role") == "user":
                    question = m.get("content", "")
                elif m.get("role") == "assistant":
                    answer = m.get("content", "")
        else:
            question = obj.get("question", "")
            answer = obj.get("answer", "") or obj.get("content", "")
        if not answer:
            continue
        title = (question[:80] or path.stem.replace("_", " ")).strip()
        text = f"Q: {question}\nA: {answer}" if question else answer
        out.append((title, text))
    return out


def ingest_class_folder(conn: sqlite3.Connection, folder: Path) -> tuple[int, int]:
    """Ingest one <class> folder. Returns (docs, chunks). Skips if no metadata."""
    meta_path = folder / "metadata.json"
    if not meta_path.exists():
        print(f"  ! no metadata.json in {folder} — folder skipped", file=sys.stderr)
        return (0, 0)
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    curriculum = meta["curriculum"]
    subject = meta["subject"]
    class_level = meta["class_level"]

    docs = chunks_written = 0
    for jf in sorted(folder.glob("*.jsonl")):
        is_exam_bank = 1 if jf.stem.endswith("past_questions") else 0
        source_type = "past_questions" if is_exam_bank else "tutor_qa"
        topic = "" if is_exam_bank else jf.stem.replace("_", " ")
        for title, text in extract_records(jf):
            parts = chunk_text(text)
            if not parts:
                continue
            doc_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO curriculum_documents "
                "(id, title, curriculum, subject, class_level, topic, "
                " source_type, source_file, is_exam_bank, chunk_count) "
                "VALUES (?,?,?,?,?,?,?,?,?,?)",
                (doc_id, title, curriculum, subject, class_level, topic,
                 source_type, jf.name, is_exam_bank, len(parts)),
            )
            for idx, chunk in enumerate(parts):
                conn.execute(
                    "INSERT INTO curriculum_fts "
                    "(content, title, curriculum, subject, class_level, topic, "
                    " source_type, is_exam_bank, document_id) "
                    "VALUES (?,?,?,?,?,?,?,?,?)",
                    (chunk, title, curriculum, subject, class_level, topic,
                     source_type, str(is_exam_bank), doc_id),
                )
                chunks_written += 1
            docs += 1
    return (docs, chunks_written)


def main() -> int:
    ap = argparse.ArgumentParser(description="Ingest curriculum knowledge into FTS5.")
    ap.add_argument("--dataset", default=str(REPO / "dataset"),
                    help="Root dataset folder")
    ap.add_argument("--curriculum", default=None,
                    help="Only this curriculum (default: every curriculum found)")
    ap.add_argument("--db", default=str(REPO / "src-tauri" / "curriculum.db"),
                    help="SQLite database the app reads")
    ap.add_argument("--reset", action="store_true",
                    help="Clear existing curriculum rows before ingesting")
    args = ap.parse_args()

    dataset = Path(args.dataset)
    if not dataset.is_dir():
        print(f"error: dataset folder not found: {dataset}", file=sys.stderr)
        return 1

    Path(args.db).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(args.db)
    ensure_schema(conn)
    if args.reset:
        conn.execute("DELETE FROM curriculum_fts")
        conn.execute("DELETE FROM curriculum_documents")

    curricula = ([args.curriculum] if args.curriculum
                 else sorted(p.name for p in dataset.iterdir() if p.is_dir()))
    total_docs = total_chunks = 0
    for curriculum in curricula:
        croot = dataset / curriculum
        if not croot.is_dir():
            continue
        for class_folder in sorted(croot.glob("*/*/*")):  # subject/phase/class
            if class_folder.is_dir():
                d, c = ingest_class_folder(conn, class_folder)
                total_docs += d
                total_chunks += c

    conn.commit()
    conn.close()
    print(f"Ingested {total_docs} docs -> {total_chunks} chunks into {args.db}")
    print(f"Verify with:  python rag/query.py --db {args.db} "
          f"-c nigerian -s mathematics -l jss3 \"solve for x\"")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
