# SkoolBox AI Engine — Handoff & Implementation Plan

**The pivot:** SkoolBox is moving Martha (its Nigerian NERDC tutor) from cloud
Claude to a **fully offline** AI engine. The chosen direction is a **LoRA
fine-tuned Qwen3 4B** model, shipped as a quantized GGUF and grounded with local
RAG. This document is the single source of truth for where we are, what's left,
and everything a teammate needs to move it forward.

- **MVP target:** 2026-06-30
- **Tutor persona:** **Martha** (the SkoolBox AI tutor) — used in all dataset system prompts
- **Base model:** Qwen3 4B (per the LoRA Fine-Tuning Guide)
- **Training data:** Nigerian curriculum (`dataset/`) **blended** with ~30% general Qwen-style instruction data
- **Today's runtime fallback:** `qwen2.5:7b-instruct` (3B installed) via Ollama
- **Audience:** ML dev, app devs, subject experts, curriculum reviewers, QA

---

## 1. Why we pivoted

1. **Offline-first.** Schools have unreliable internet; the AI must run with no
   connection. Cloud Claude can't be the runtime.
2. **CPU is slow.** Live generation on a school's CPU (no GPU, ~4 tok/s on the
   3B) makes full lessons take minutes. Two mitigations are already in place:
   pre-generated ("baked") lessons, and a small local model only for short
   interactions (Q&A, answer evaluation).
3. **Curriculum fidelity.** A general model doesn't know NERDC/WAEC/NECO. The
   pivot adds **LoRA fine-tuning** on team-written curriculum examples so the
   model speaks and teaches the Nigerian way — on top of persona prompting + RAG.

---

## 2. Current status

### ✅ Done — App AI engine (offline runtime)
- **Provider abstraction:** runtime backend chosen via a `model_provider` DB
  setting (`ollama` default, `claude` alt), resolved in `src-tauri/src/ai/provider.rs`.
  `ai/ollama.rs` talks to `localhost:11434`. All Rust call sites route through
  `provider`; the backend is offline-by-default.
- **Auto model select:** `ollama::best_installed_model()` prefers 7b-instruct,
  falls back through to whatever is installed (3B today).
- **Constrained JSON:** lesson/quiz generation uses `provider::generate_json`
  (Ollama `format:"json"` + cleaning + validation + retry) via `ai/json.rs`.
- **RAG (SQLite FTS5):** `ai/chunking.rs` + `curriculum_documents`/`curriculum_fts`
  tables + `rag::search_curriculum` (BM25, subject/class filtered). Curriculum
  admin UI at `CurriculumLibraryPage.tsx`.
- **Curriculum packs:** export/import curriculum + baked lessons as JSON files;
  first-run seed from a bundled `default_curriculum_pack.json`.
- **Pre-generated lessons:** `generated_lessons` table + `bake_lesson` (run once
  on capable hardware) + instant playback in `ClassSessionPage.tsx`.
- **Offline voice:** Piper neural TTS (en_US-amy) driven from Rust `commands/tts.rs`,
  with `spd-say` fallback; speech math normalization.
- **Unified 30-min whiteboard classroom:** `ClassSessionPage.tsx` (plan →
  teach segments → check question → evaluate), with next-segment prefetch.

### ✅ Done — Fine-tuning monorepo (this pivot's scaffolding)
- In-place monorepo: app stays at repo root; `dataset/`, `training/`, `rag/`
  added alongside. See [MONOREPO.md](MONOREPO.md) and [COLLABORATION.md](COLLABORATION.md).
- `training/merge_dataset.py` — combine + validate all dataset JSONL (working).
- `training/train.py` — Unsloth LoRA on Qwen3 4B (scaffold, runs on GPU).
- `training/merge_lora.py`, `training/convert_to_gguf.py` — merge + Q4_K_M GGUF.
- `rag/ingest.py` — chunk curriculum docs into the app's FTS5 schema (working).
- Sample dataset: `dataset/mathematics/jss2/linear_equations.jsonl`.

### ⚠️ Known gaps / regressions
- **Real model not trained yet.** No SkoolBox GGUF exists — the dataset is a
  single 4-example sample; the pipeline has never run end-to-end on real data.
- **Content correctness on small models is weak.** The 3B produces valid JSON
  structure but unreliable math reasoning. Needs the 7B / GPU, or — the point of
  this pivot — a fine-tuned model.
- **Voice is US-accented.** Piper en_US-amy; no en-NG voice yet.
- **RAG ranking is naive.** `rag.rs` OR-s query words, so a passage matching only
  a common word can outrank a topical one (verifiable with `rag/query.py`). The
  app mitigates this by always scoping retrieval by subject + class level.
  Phrase/weighted queries or vector search are post-MVP.
- **Orphaned routes:** the old `TeachPage` (Recent Lessons replay) and
  `PresentationPage` were left unrouted when the classroom was unified —
  Recent Lessons replay is currently unreachable. Verify before relying on them.
- **Network blocker:** pulling `qwen2.5:7b-instruct` failed on the dev network
  (IPv6 unreachable; IPv4 works). Only the 3B is installed locally.

---

## 3. What's left to do (the path to a trained model)

### Phase A — Data (subject experts + curriculum reviewers) 🟢
1. Write curriculum examples in `dataset/<subject>/<level>/<topic>.jsonl`.
   Target ≥ 200 high-quality examples per subject per class level
   (≥ 5,000 lines total before a serious run; below 1,000 results are weak).
2. Use the system-prompt templates and rules in [dataset/README.md](dataset/README.md).
3. Curriculum reviewer approves via PR (check NERDC/WAEC accuracy, JSON validity).

### Phase B — Training (ML dev) 🔵
4. `python training/merge_dataset.py --input dataset/ --output training/skoolbox_train.jsonl`
5. On GPU (Colab Pro A100 / RunPod): `python training/train.py --model qwen3-4b
   --dataset training/skoolbox_train.jsonl --mix-dataset trl-lib/Capybara
   --mix-ratio 0.3 --epochs 3 --lora-r 16`. We **blend** ~30% general Qwen-style
   instruction data with the curriculum so Martha keeps general ability and
   doesn't "forget" (see training/README.md → Blending).
6. `python training/merge_lora.py` → `python training/convert_to_gguf.py`
   (output `src-tauri/ai/models/skoolbox-qwen3-4b-v1.0-Q4_K_M.gguf`).
7. Test via Ollama against the checklist in [training/README.md](training/README.md).

### Phase C — Integration (app dev) 🔵
8. Bundle the GGUF (Git LFS) + Modelfile (`src-tauri/ai/Martha.Modelfile`).
9. Point the app's default model at the fine-tuned build; rebuild installers.
10. Re-bake lessons with the new model; refresh curriculum packs.

### Phase D — Content + RAG 🔵
11. Ingest real NERDC textbooks / past questions via `rag/ingest.py` (writes the
    app's production FTS5 schema), then verify with `rag/query.py` (mirrors
    `rag.rs`; always pass `-s`/`-l`). Workflow + layout: `rag/README.md`,
    example docs in `rag/docs.sample/`.
12. Seed the default curriculum pack with real content (not the 3-doc sample).

### Phase E — Polish / post-MVP
- Nigerian-accent voice (Piper has no en-NG — evaluate alternatives).
- Re-route or retire the orphaned `TeachPage` / `PresentationPage`.
- Embedding-based vector RAG (currently keyword FTS5).
- Iteration loop: QA files gaps → more data → retrain → version bump.

---

## 4. What's needed (resources & access)

| Need | Detail |
| --- | --- |
| **GPU** | Google Colab Pro (A100, ~$12/mo) or RunPod (RTX 4090 / A100 40GB). ~$10–25 per training run. Laptops can't train. |
| **Base model** | `unsloth/Qwen3-4B` from Hugging Face. |
| **Training deps** | `pip install -r training/requirements.txt` (unsloth, transformers, datasets, trl, peft, accelerate, bitsandbytes). |
| **llama.cpp** | Cloned + built for the GGUF quantization step (set `LLAMA_CPP_DIR`). |
| **Git LFS** | `git lfs install && git lfs track "*.gguf"` — the GGUF is ~2.6 GB. |
| **Curriculum source** | Real NERDC/WAEC/NECO textbooks + past questions for dataset writing and RAG ingest. |
| **Team** | Subject experts (data), curriculum reviewer (QA), ML dev (training), app dev (integration), QA tester. |
| **Repo access** | GitHub `foniolabs/skoolbox` collaborator invite. |

---

## 5. Team roles & workflow

| Role | Works in | Reads |
| --- | --- | --- |
| Subject expert / teacher | `dataset/` | [dataset/README.md](dataset/README.md) |
| Curriculum reviewer | `dataset/` (PR review) | [COLLABORATION.md](COLLABORATION.md) |
| ML developer | `training/` | [training/README.md](training/README.md) |
| App developer | `src/`, `src-tauri/` | [README.md](README.md) |
| RAG / data developer | `rag/` | [rag/README.md](rag/README.md) |
| QA tester | the app | [training/README.md](training/README.md) §test checklist |

**Iteration cycle:** experts push examples → reviewer approves PR → ML dev
retrains → new GGUF tested + versioned (`v1.0`, `v1.1`, …) → app dev rebuilds →
QA verifies → repeat.

---

## 6. Key files & locations

| Area | Path |
| --- | --- |
| Monorepo overview | [MONOREPO.md](MONOREPO.md) |
| Collaboration rules | [COLLABORATION.md](COLLABORATION.md) |
| Training data | `dataset/<subject>/<level>/<topic>.jsonl` |
| Training pipeline | `training/` |
| RAG ingest | `rag/ingest.py` |
| Runtime AI engine | `src-tauri/src/ai/` (provider, ollama, rag, classroom, json) |
| AI commands | `src-tauri/src/commands/` (ai, agent, classroom, knowledge, curriculum, tts) |
| Ollama Modelfile | `src-tauri/ai/Martha.Modelfile` |
| Bundled model (to add) | `src-tauri/ai/models/skoolbox-qwen3-4b-vX-Q4_K_M.gguf` |
| Classroom UI | `src/pages/ClassSessionPage.tsx` |
| Curriculum admin UI | `src/pages/CurriculumLibraryPage.tsx` |

---

## 7. MVP readiness checklist

- [ ] App installs cleanly on a fresh Windows 10/11 machine (no internet)
- [ ] AI answers fully offline after install
- [ ] Answers are curriculum-aligned (10 WAEC-style Qs across 3 subjects)
- [ ] Language adapts by class level (same Q as Primary 5 vs SS2)
- [ ] Lesson note generation works
- [ ] Quiz generation works
- [ ] Response time under 3 seconds to first token
- [ ] Off-curriculum questions handled gracefully
- [ ] Installer under 5 GB
- [ ] Runs on Intel i3 / 8 GB RAM

---

*Status as of 2026-06-19. App-side details reflect the last working session —
verify against current code before relying on a specific file or function.*
