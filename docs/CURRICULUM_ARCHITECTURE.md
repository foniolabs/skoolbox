# SkoolBox Curriculum Architecture & Knowledge System

> Foniolabs · adapted from *Curriculum Architecture v1.0 (June 2026)* · internal.
> This file is the in-repo reference; it records where v1.0 was implemented as-is
> and where we deliberately deviated. Linked from `skoolbox-config.json`,
> `rag/ingest.py`, and `rag/query.py`.

## 1. Core principle — architecture does the work

The LLM (Qwen3 4B) only explains the content it is handed. The **folder
structure**, the **`metadata.json` contract**, and the **retrieval filter**
decide what content it is handed. If retrieval filters to JSS2, the model
explains at JSS2 level. The model never sees content it was not given.

| Layer | Responsibility | Where it lives |
| --- | --- | --- |
| Folder structure | Organise content by curriculum → subject → phase → class | `dataset/` |
| Metadata schema | Tag every class folder with its curriculum context | `metadata.json` per class folder |
| Retrieval filter | Fetch only relevant content before the LLM sees anything | `rag/ingest.py`, `rag/query.py`, `src-tauri/src/ai/rag.rs` |

## 2. Folder structure

Four levels: **curriculum → subject → phase → class**. (We add a `phase/`
level — `primary` / `jss` / `ss` — between subject and class to keep large
subjects navigable; v1.0 drew this implicitly.)

```
dataset/
└── nigerian/                     Level 1: curriculum
    └── mathematics/              Level 2: subject
        └── jss/                  phase (primary | jss | ss)
            └── jss2/             Level 3: class
                ├── metadata.json Level 4: context contract (required)
                └── linear_equations.jsonl
            └── jss3/             exam class (BECE)
                ├── metadata.json is_exam_class: true
                ├── simultaneous_equations.jsonl
                └── waec_bece_past_questions.jsonl
```

### File naming

| File type | Convention | Example |
| --- | --- | --- |
| Tutoring data | `<topic>.jsonl` | `linear_equations.jsonl` |
| Past questions | `<exam_body>_past_questions.jsonl` | `waec_bece_past_questions.jsonl` |
| Metadata | `metadata.json` (fixed) | `metadata.json` |

> Deviation: v1.0 proposed `<textbook>_<class>.jsonl`. We keep topic-named files
> because the dataset is currently one topic per file and topic names preserve
> retrieval granularity. `textbooks` are still recorded in `metadata.json`.

## 3. The `metadata.json` contract

Every class folder must contain exactly one `metadata.json`. Without it,
`ingest.py` skips the folder. Generate/refresh them with
`python rag/scaffold_metadata.py` (idempotent; preserves the `topics` and
`textbooks` lists subject experts edit).

**Standard class** (Primary 1–4, JSS1/2, SS1/2): `is_exam_class: false`,
`retrieval_mode: "standard"`, empty `prerequisite_levels`.

**Exam class** (Primary 5/6, JSS3, SS3): `is_exam_class: true`,
`retrieval_mode: "tiered"`, populated `prerequisite_levels`, plus
`retrieval_weights` (`own_class`, `prerequisites`, `exam_bank`, summing to 1.0).

Full field reference: `curriculum`, `subject`, `class_level`, `class_display`,
`age_range`, `exam_body`, `is_exam_class`, `prerequisite_levels`,
`retrieval_mode`, `retrieval_weights` (if tiered), `textbooks`, `topics`.

## 4. Retrieval strategy

The student's class `metadata.json` selects the mode; weights live in
`skoolbox-config.json → rag.retrieval_modes` and are mirrored in `rag/query.py`
and `src-tauri/src/ai/rag.rs`.

| Mode | own | prereq | exam | When |
| --- | --- | --- | --- | --- |
| Standard | 1.00 | 0.00 | 0.00 | Non-exam classes |
| Tiered | 0.70 | 0.25 | 0.05 | Exam classes (default) |
| Remediation | 0.20 | 0.75 | 0.05 | Teacher flags student / 3+ wrong on a topic |
| Revision | 0.40 | 0.40 | 0.20 | Student requests exam practice |

Each active tier is a separate query; hits are scored by
`BM25_relevance × tier_weight`, merged, and the top N (4) passed to the LLM.

**Exam class map:** Primary 5 (Common Entrance), Primary 6 (FSLC + Common
Entrance), JSS3 (WAEC BECE), SS3 (WAEC SSCE + NECO).

## 5. The index — SQLite FTS5 (deliberate deviation from ChromaDB)

> v1.0 specified ChromaDB + BGE-M3 embeddings. We ship **SQLite FTS5** instead.

Rationale: SkoolBox runs **fully offline** on modest school hardware. ChromaDB +
a BGE-M3 embedding model would add a vector service and a ~2 GB model on top of
Qwen3 4B. FTS5 is built into the SQLite that `rusqlite` already bundles, so the
index is a **single file with zero extra runtime dependencies**. We implement
v1.0's retrieval *semantics* (the metadata contract + tiered/remediation/revision
weighting) on FTS5 + BM25. Embedding-based reranking is a tracked post-MVP item.

**Chunk metadata** carried in `curriculum_fts` (what the filter queries):
`curriculum`, `subject`, `class_level`, `topic`, `source_type`, `is_exam_bank`,
`document_id` (+ `content`, `title`). The schema is defined identically in
`rag/ingest.py` and `src-tauri/src/db/connection.rs` so a Python-built index is a
drop-in for the app.

## 6. Multi-curriculum design

The same model serves every curriculum. Curriculum identity is delivered at
runtime, not baked into weights:

- `skoolbox-config.json` — `active_curriculum` + retrieval config.
- `curriculum/<name>.json` — levels, subjects, standards (single source of truth).
- `curriculum/<name>.system_prompt.txt` — who Martha is for that curriculum.

> Deviation: v1.0 proposed a separate `curricula/<name>/subjects.json`. We extend
> the existing `curriculum/<name>.json` instead of duplicating level/subject data.

Roadmap: v1.0 Nigerian (MVP) → v2.0 British, American → v3.0 Montessori + hybrids.
Hybrids blend two system prompts and search two curricula's collections with the
primary curriculum weighted higher.
