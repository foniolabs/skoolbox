#!/usr/bin/env python3
"""Ingest curriculum documents into the SkoolBox RAG index.

Chunks plain-text curriculum material (textbook extracts, NERDC/WAEC syllabuses,
past questions) and writes it into the `curriculum_fts` SQLite FTS5 table that
the Tauri app reads at runtime (see src-tauri/src/ai/rag.rs).

> Note: the guide mentions ChromaDB, but the shipping app uses SQLite FTS5 so the
> index bundles as a single file with zero extra runtime dependencies. This tool
> matches the app.

Input layout (mirrors dataset/):
    docs/<subject>/<class_level>/<title>.txt

Usage:
    python rag/ingest.py --input rag/docs --db src-tauri/curriculum.db
    python rag/ingest.py --input rag/docs --db src-tauri/curriculum.db --source-type past_question
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

# Keep chunks comfortably inside the model context while preserving sentences.
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 150


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
        start = max(end - CHUNK_OVERLAP, end) if end == len(text) else end - CHUNK_OVERLAP
    return [c for c in chunks if c]


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """CREATE VIRTUAL TABLE IF NOT EXISTS curriculum_fts USING fts5(
               content, title, source_type, subject, class_level
           )"""
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Ingest curriculum docs into FTS5.")
    ap.add_argument("--input", default="rag/docs", help="Root folder of .txt docs")
    ap.add_argument("--db", default="src-tauri/curriculum.db",
                    help="SQLite database the app reads")
    ap.add_argument("--source-type", default="textbook",
                    help="Label for these docs (textbook | syllabus | past_question)")
    ap.add_argument("--reset", action="store_true",
                    help="Clear existing rows before ingesting")
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

    docs, chunks_written = 0, 0
    for path in sorted(root.rglob("*.txt")):
        rel = path.relative_to(root).parts
        subject = rel[0] if len(rel) > 1 else ""
        class_level = rel[1] if len(rel) > 2 else ""
        title = path.stem.replace("_", " ")
        for chunk in chunk_text(path.read_text(encoding="utf-8")):
            conn.execute(
                "INSERT INTO curriculum_fts "
                "(content, title, source_type, subject, class_level) "
                "VALUES (?, ?, ?, ?, ?)",
                (chunk, title, args.source_type, subject, class_level),
            )
            chunks_written += 1
        docs += 1

    conn.commit()
    conn.close()
    print(f"Ingested {docs} docs → {chunks_written} chunks into {args.db}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
