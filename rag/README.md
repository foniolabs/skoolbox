# `rag/` — Curriculum Retrieval Index

> 🔵 **Developers only.**

Retrieval-Augmented Generation (RAG) lets Martha quote real curriculum material
(textbook extracts, NERDC/WAEC syllabuses, past questions) instead of relying
only on what fine-tuning baked in. This folder builds the search index that the
Tauri app reads at runtime.

## How it works

The shipping app uses **SQLite FTS5** (full-text search) — see
[`../src-tauri/src/ai/rag.rs`](../src-tauri/src/ai/rag.rs), which queries the
`curriculum_fts` table with BM25 ranking, filtered by subject and class level.
`ingest.py` chunks your documents and writes them into exactly that table.

> The fine-tuning guide mentions ChromaDB; we use SQLite FTS5 instead so the
> index ships as a single file with no extra runtime services — a better fit for
> a fully offline desktop app.

## Document layout

Drop plain-text files under `docs/`, mirroring the dataset structure so subject
and class level are picked up automatically:

```
rag/docs/<subject>/<class_level>/<title>.txt
e.g. rag/docs/biology/ss2/photosynthesis.txt
```

## Run

```bash
# Textbook / syllabus material
python rag/ingest.py --input rag/docs --db src-tauri/curriculum.db

# Past questions (label them so retrieval can prefer exam-style sources)
python rag/ingest.py --input rag/docs --db src-tauri/curriculum.db \
    --source-type past_question

# Rebuild from scratch
python rag/ingest.py --input rag/docs --db src-tauri/curriculum.db --reset
```

Uses only the Python standard library (`sqlite3`) — no extra installs.

`docs/` and generated `*.db` files are git-ignored; see [`../.gitignore`](../.gitignore).
