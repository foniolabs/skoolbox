# SkoolBox Monorepo

One repository houses every part of SkoolBox — the offline AI tutor for the
Nigerian curriculum. This keeps the app, its training data, the fine-tuning
pipeline, and the retrieval index versioned together.

```
schoolbox/
├── src/             🔵 Tauri app — React + TypeScript frontend
├── src-tauri/       🔵 Tauri app — Rust backend (AI engine, RAG, DB)
│   └── ai/          Ollama Modelfile + runtime AI modules
├── dataset/         🟢 Training examples — SUBJECT EXPERTS WORK HERE
├── training/        🔵 LoRA fine-tuning pipeline (Qwen3 4B → GGUF)
├── rag/             🔵 Curriculum retrieval index builder
├── package.json     Frontend deps & scripts
└── MONOREPO.md      ← you are here
```

> The fine-tuning guide draws `app/` as a subfolder. Here the Tauri app stays at
> the repo root (`src/` + `src-tauri/`) so existing build paths and tooling keep
> working; `dataset/`, `training/`, and `rag/` are added alongside it.

## Who works where

| Role | Folder | Read |
| --- | --- | --- |
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
