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

> The architecture doc specifies ChromaDB + BGE-M3; we use SQLite FTS5 instead so
> the index ships as a single file with no extra runtime services — a better fit
> for a fully offline desktop app. We implement the doc's retrieval *semantics*
> (metadata contract + tiered weighting) on FTS5. See
> [`../docs/CURRICULUM_ARCHITECTURE.md`](../docs/CURRICULUM_ARCHITECTURE.md) §5.

## What gets indexed

`ingest.py` reads the **`dataset/` tree directly** — there is no separate `docs/`
folder. Each class folder's `metadata.json` is the contract: the assistant
answers in its `.jsonl` files become retrievable knowledge, tagged with
curriculum, subject, class level, topic, and an `is_exam_bank` flag (for
`*_past_questions.jsonl` files). Folders without `metadata.json` are skipped.

## Tiered retrieval

`query.py` and the app (`rag.rs`) pick a retrieval mode from the class's
`metadata.json` and merge weighted tiers (own class / prerequisites / exam bank):

| Mode | own | prereq | exam | When |
| --- | --- | --- | --- | --- |
| standard | 1.00 | 0.00 | 0.00 | non-exam classes |
| tiered | 0.70 | 0.25 | 0.05 | exam classes (default) |
| remediation | 0.20 | 0.75 | 0.05 | student struggling |
| revision | 0.40 | 0.40 | 0.20 | exam practice |

Weights live in `skoolbox-config.json → rag.retrieval_modes`.

## Producer workflow

```bash
# 1. Make sure every class folder has metadata.json
python rag/scaffold_metadata.py

# 2. Ingest the dataset into the app's production schema
python rag/ingest.py --curriculum nigerian --db src-tauri/curriculum.db --reset

# 3. Verify retrieval BEFORE shipping (mirrors the app's rag.rs)
python rag/query.py --db src-tauri/curriculum.db --stats
python rag/query.py -c nigerian -s mathematics -l jss3 "solve simultaneous equations"
#    Force a mode to test remediation/revision behaviour:
python rag/query.py -c nigerian -s mathematics -l jss3 --mode remediation "linear equation"
```

All three scripts use only the Python standard library (`sqlite3`). Pass
**curriculum + subject + class** (`-c -s -l`) to reproduce real app behaviour.

## ⚠️ Retrieval quality note

The FTS query is built by **OR-ing** the question's words, so a passage matching
only a common word can rank higher than expected. This is mitigated because
retrieval is always scoped by curriculum + subject + class (+ tier weighting).
Embedding-based reranking is a tracked post-MVP item in
[`../HANDOFF.md`](../HANDOFF.md).

Generated `*.db` files are git-ignored; see [`../.gitignore`](../.gitignore).
