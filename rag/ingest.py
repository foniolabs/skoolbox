#!/usr/bin/env python3
"""Ingest curriculum documents into the SkoolBox RAG index.

Chunks plain-text curriculum material (textbook extracts, NERDC/WAEC syllabuses,
past questions) and writes it into the `curriculum_documents` + `curriculum_fts`
tables that the Tauri app reads at runtime (see src-tauri/src/db/connection.rs
and src-tauri/src/ai/rag.rs). The schema here mirrors production exactly, so the
db this produces is a drop-in for the app.

> Note: the guide mentions ChromaDB, but the shipping app uses SQLite FTS5 so the
> index bundles as a single file with zero extra runtime dependencies.

Input layout (mirrors dataset/ — see ../rag/docs.sample/ for an example):
    docs/<subject>/<class_level>/<title>.txt

Usage:
    python rag/ingest.py --input rag/docs --db src-tauri/curriculum.db
    python rag/ingest.py --input rag/docs --db src-tauri/curriculum.db --source-type past_questions

source_type is one of: textbook | curriculum | past_questions | lesson_notes
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
import uuid
from pathlib import Path

# Keep chunks comfortably inside the model context while preserving sentences.
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 150
SOURCE_TYPES = ("textbook", "curriculum", "past_questions", "lesson_notes")


def chunk_text(text: str) -> list[str]:
    text = " ".join(text.split())
    if not text:
        return []
    chunks, start = [], 0
    while start < len(text):
        end = min(start + CHUNK_CHARS, len(text))
        # Prefer to break on a sentence boundary near the end of the window.
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
            subject TEXT,
            class_level TEXT,
            source_type TEXT NOT NULL DEFAULT 'textbook',
            chunk_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS curriculum_fts USING fts5(
            content,
            title UNINDEXED,
            subject UNINDEXED,
            class_level UNINDEXED,
            source_type UNINDEXED,
            document_id UNINDEXED,
            tokenize = 'porter unicode61'
        );
        """
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Ingest curriculum docs into FTS5.")
    ap.add_argument("--input", default="rag/docs", help="Root folder of .txt docs")
    ap.add_argument("--db", default="src-tauri/curriculum.db",
                    help="SQLite database the app reads")
    ap.add_argument("--source-type", default="textbook", choices=SOURCE_TYPES,
                    help="Label for these docs")
    ap.add_argument("--reset", action="store_true",
                    help="Clear existing curriculum rows before ingesting")
    args = ap.parse_args()

    root = Path(args.input)
    if not root.is_dir():
        print(f"error: input folder not found: {root}", file=sys.stderr)
        return 1

    Path(args.db).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(args.db)
    ensure_schema(conn)
    if args.reset:
        conn.execute("DELETE FROM curriculum_fts")
        conn.execute("DELETE FROM curriculum_documents")

    docs, chunks_written = 0, 0
    for path in sorted(root.rglob("*.txt")):
        rel = path.relative_to(root).parts
        subject = rel[0] if len(rel) > 1 else ""
        class_level = rel[1] if len(rel) > 2 else ""
        title = path.stem.replace("_", " ")
        chunks = chunk_text(path.read_text(encoding="utf-8"))
        if not chunks:
            continue
        doc_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO curriculum_documents "
            "(id, title, subject, class_level, source_type, chunk_count) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (doc_id, title, subject, class_level, args.source_type, len(chunks)),
        )
        for chunk in chunks:
            conn.execute(
                "INSERT INTO curriculum_fts "
                "(content, title, subject, class_level, source_type, document_id) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (chunk, title, subject, class_level, args.source_type, doc_id),
            )
            chunks_written += 1
        docs += 1

    conn.commit()
    conn.close()
    print(f"Ingested {docs} docs -> {chunks_written} chunks into {args.db}")
    print("Verify retrieval with:  python rag/query.py --db "
          f"{args.db} \"your question\"")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
