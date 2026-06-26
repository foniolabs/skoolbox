# SkoolBox Monorepo

One repository houses every part of SkoolBox — the offline AI tutor for the
Nigerian curriculum. This keeps the app, its training data, the fine-tuning
pipeline, and the retrieval index versioned together.

```
schoolbox/
├── src/                  🔵 Tauri app — React + TypeScript frontend
├── src-tauri/            🔵 Tauri app — Rust backend (AI engine, RAG, DB)
│   └── ai/               Ollama Modelfile + runtime AI modules
├── curriculum/           🟢🔵 Curriculum frameworks + system prompts (NG/UK/US)
├── dataset/              🟢 Training data — SUBJECT EXPERTS WORK HERE
│   └── nigerian/<subject>/<phase>/<class>/{metadata.json, *.jsonl}
├── training/             🔵 LoRA fine-tuning pipeline (Qwen3 4B → GGUF)
├── rag/                  🔵 Retrieval index builder + metadata scaffolder
├── docs/                 📄 CURRICULUM_ARCHITECTURE.md (knowledge-system spec)
├── skoolbox-config.json  Active curriculum + RAG retrieval config (app reads this)
├── package.json          Frontend deps & scripts
├── MVP_PLAN.md           Multi-curriculum co-pilot MVP plan
└── MONOREPO.md           ← you are here
```

> Knowledge-system architecture (folder hierarchy, `metadata.json` contract,
> tiered retrieval, FTS5-vs-ChromaDB decision) is specified in
> [docs/CURRICULUM_ARCHITECTURE.md](docs/CURRICULUM_ARCHITECTURE.md).

> Direction (2026-06): Martha is a **classroom co-pilot** (not a teacher
> replacement) that works within a school's **chosen curriculum** — Nigerian,
> British, or American. See [MVP_PLAN.md](MVP_PLAN.md).

> The fine-tuning guide draws `app/` as a subfolder. Here the Tauri app stays at
> the repo root (`src/` + `src-tauri/`) so existing build paths and tooling keep
> working; `dataset/`, `training/`, and `rag/` are added alongside it.

## Who works where

| Role | Folder | Read |
| --- | --- | --- |
| Curriculum experts | `curriculum/` | [curriculum/README.md](curriculum/README.md) |
| Subject experts / teachers | `dataset/` | [dataset/README.md](dataset/README.md) |
| ML developers | `training/` | [training/README.md](training/README.md) |
| App developers | `src/`, `src-tauri/` | [README.md](README.md) |
| RAG / data developers | `rag/` | [rag/README.md](rag/README.md) |

## The end-to-end flow

1. **Subject experts** write curriculum examples in `dataset/` (`.jsonl`).
2. **ML devs** merge + LoRA fine-tune Qwen3 4B in `training/`, producing a
   quantized `.gguf` model.
3. **RAG devs** ingest curriculum documents into the FTS5 index in `rag/`.
4. **App devs** bundle the model + index into the Tauri app and ship installers.

See each folder's README for exact commands.
