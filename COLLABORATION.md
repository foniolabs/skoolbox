# Working in the SkoolBox Monorepo

This explains **what's shared through git and what isn't**, so every teammate
knows how to get the files they need. See [MONOREPO.md](MONOREPO.md) for the
folder layout and [dataset/README.md](dataset/README.md) for how to write data.

The rule of thumb: **everything a human authors is committed; only machine
output is ignored.**

## ✅ Tracked — your colleagues get these on `git pull`

- **All the scripts** — [train.py](training/train.py),
  [merge_dataset.py](training/merge_dataset.py),
  [convert_to_gguf.py](training/convert_to_gguf.py),
  [merge_lora.py](training/merge_lora.py), [ingest.py](rag/ingest.py)
- **All READMEs** + [MONOREPO.md](MONOREPO.md)
- **`dataset/**/*.jsonl`** — the training examples subject experts write. This is
  the whole point of the dataset folder; it is **not** ignored. A teacher writes
  `dataset/mathematics/jss2/algebra.jsonl`, commits, pushes — everyone gets it.

## 🚫 Ignored — because they're regenerated or too big for git

| Ignored | How a colleague gets it instead |
| --- | --- |
| `training/skoolbox_train.jsonl` | Run `merge_dataset.py` — it rebuilds from everyone's `dataset/*.jsonl` |
| `skoolbox-lora-adapters/`, `-merged/`, checkpoints | Output of a GPU training run (multi-GB); produced on Colab/RunPod, not shared via git |
| `*.db` (RAG index) | Run `ingest.py` to rebuild locally |
| `rag/docs/` | Raw curriculum source documents — distributed via the curriculum-pack mechanism, not git |
| final `.gguf` model | Shared via **Git LFS** (the one large file that *does* go in git) |

## A teammate's flow

```
git pull            # get everyone's latest examples + scripts
# write .jsonl examples in dataset/<subject>/<level>/<topic>.jsonl
git add .
git commit -m "Add JSS2 algebra examples"
git push            # everyone now has them
```

Nothing a teammate needs to write data is blocked — the scripts and all `.jsonl`
data come down with `git pull`; only large machine-generated artifacts are left
out and rebuilt locally.

---

# What's been done for the monorepo

The LoRA fine-tuning monorepo from the SkoolBox guide was scaffolded **in place**
alongside the existing Tauri app. The app stays at the repo root (`src/` +
`src-tauri/`); three new sibling folders were added.

## Decisions

- **App stays at repo root** (not moved into an `app/` subfolder) — existing
  build paths and in-progress work stay untouched.
- **Base model is Qwen3 4B**, per the fine-tuning guide.
- **RAG uses SQLite FTS5, not ChromaDB.** The shipping app already reads a
  `curriculum_fts` FTS5 table ([src-tauri/src/ai/rag.rs](src-tauri/src/ai/rag.rs)),
  so the index bundles as a single file with no extra runtime services — the
  right fit for a fully offline desktop app.

## Added

| Path | Purpose |
| --- | --- |
| [MONOREPO.md](MONOREPO.md) | Folder layout + who-works-where overview |
| [COLLABORATION.md](COLLABORATION.md) | This file — tracked vs ignored, team flow |
| [dataset/](dataset/) | Subject experts write `.jsonl` chat examples |
| [dataset/README.md](dataset/README.md) | System-prompt templates (Primary/JSS/SS) + rules |
| [dataset/mathematics/jss2/linear_equations.jsonl](dataset/mathematics/jss2/linear_equations.jsonl) | Working 4-example sample |
| [training/merge_dataset.py](training/merge_dataset.py) | Validates + combines all `dataset/*.jsonl` (stdlib only, working) |
| [training/train.py](training/train.py) | LoRA fine-tune Qwen3 4B with Unsloth |
| [training/merge_lora.py](training/merge_lora.py) | Merge adapters into the base model |
| [training/convert_to_gguf.py](training/convert_to_gguf.py) | Quantize to Q4_K_M GGUF via llama.cpp |
| [training/requirements.txt](training/requirements.txt) | Training deps (GPU) |
| [training/README.md](training/README.md) | End-to-end pipeline + commands |
| [rag/ingest.py](rag/ingest.py) | Chunk curriculum docs into the FTS5 index |
| [rag/README.md](rag/README.md) | RAG ingest usage |
| [.gitignore](.gitignore) | Covers Python caches + training/RAG build artifacts |

## Verified working

- `merge_dataset.py` validated and merged the sample examples.
- `train.py` / `convert_to_gguf.py` `--help` work without GPU deps installed
  (heavy imports are lazy).
- `ingest.py` built a valid FTS5 index and a subject/level-filtered query
  returned the expected row.

## The pipeline at a glance

```
dataset/*.jsonl
   │  merge_dataset.py        (CPU)
   ▼
training/skoolbox_train.jsonl
   │  train.py                (GPU)  →  skoolbox-lora-adapters/
   ▼
   │  merge_lora.py           (GPU)  →  skoolbox-merged/ (~8 GB)
   ▼
   │  convert_to_gguf.py      (CPU)  →  *.gguf (~2.6 GB, Git LFS)
   ▼
   Test via Ollama  →  ship in the Tauri app
```
