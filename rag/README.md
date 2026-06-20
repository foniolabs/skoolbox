# `rag/` — Curriculum Retrieval Index

> 🔵 **Developers only.**

Retrieval-Augmented Generation (RAG) lets Martha quote real curriculum material
(textbook extracts, NERDC/WAEC syllabuses, past questions) instead of relying
only on what fine-tuning baked in. This folder builds and verifies the search
index that the Tauri app reads at runtime.

## How it works

The shipping app uses **SQLite FTS5** (full-text search) — see
[`../src-tauri/src/ai/rag.rs`](../src-tauri/src/ai/rag.rs), which queries the
`curriculum_fts` table with BM25 ranking, filtered by subject and class level.
`ingest.py` writes the **exact production schema** (`curriculum_documents` +
`curriculum_fts`, mirrored from
[`../src-tauri/src/db/connection.rs`](../src-tauri/src/db/connection.rs)), so the
db it produces is a drop-in for the app.

> The fine-tuning guide mentions ChromaDB; we use SQLite FTS5 instead so the
> index ships as a single file with no extra runtime services — a better fit for
> a fully offline desktop app.

## Document layout

Drop plain-text files under `docs/`, mirroring the dataset structure so subject
and class level are picked up automatically from the path:

```
rag/docs/<subject>/<class_level>/<title>.txt
e.g. rag/docs/biology/ss2/photosynthesis.txt
```

A worked example of the layout lives in **[`docs.sample/`](docs.sample/)** (tracked
in git). `docs/` itself is git-ignored — real curriculum source can be large or
copyrighted, so it is not committed; distribute the built index via the app's
curriculum-pack feature instead.

## Producer workflow

```bash
# 1. Put real curriculum .txt files under rag/docs/ (copy docs.sample/ to start)
cp -r rag/docs.sample/* rag/docs/        # then replace with real material

# 2. Ingest (writes the app's production schema)
python rag/ingest.py --input rag/docs --db src-tauri/curriculum.db
#    Past questions? label them so retrieval can prefer exam-style sources:
python rag/ingest.py --input rag/docs --db src-tauri/curriculum.db --source-type past_questions
#    Rebuild from scratch:
python rag/ingest.py --input rag/docs --db src-tauri/curriculum.db --reset

# 3. Verify retrieval BEFORE shipping (mirrors the app's rag.rs)
python rag/query.py --db src-tauri/curriculum.db --stats
python rag/query.py --db src-tauri/curriculum.db -s Biology -l SS2 "how do plants make food"
```

`source_type` is one of: `textbook` | `curriculum` | `past_questions` |
`lesson_notes`. Both scripts use only the Python standard library (`sqlite3`).

## ⚠️ Retrieval quality note (real app behaviour)

`rag.rs` builds the FTS query by **OR-ing** the question's words together, so a
passage that matches only a common word (e.g. a maths note containing "makes")
can outrank a topically-correct passage. This is mitigated because the app
**always scopes retrieval by subject + class level** — so always pass `-s` and
`-l` to `query.py` to reproduce real behaviour. Improving the ranking (phrase
queries, term weighting, or embedding-based vector search) is a post-MVP item in
[`../HANDOFF.md`](../HANDOFF.md).

`docs/` and generated `*.db` files are git-ignored; see [`../.gitignore`](../.gitignore).
