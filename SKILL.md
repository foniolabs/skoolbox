---
name: skoolbox-mvp-build
description: Phase-by-phase production build plan for the SkoolBox / Martha offline classroom copilot MVP (Nigerian curriculum, Qwen3 4B, SQLite FTS5 RAG, Whisper STT + neural TTS, Tauri app). Use when implementing, sequencing, or reviewing MVP work.
---

# SkoolBox MVP — Production Build Plan (Martha Classroom Copilot)

The single, ordered build guide for shipping the Martha MVP. It reconciles the
three source specs with the **actual codebase** and our **offline + SQLite**
production decisions.

**Source specs**
- Knowledge system & RAG: [docs/CURRICULUM_ARCHITECTURE.md](docs/CURRICULUM_ARCHITECTURE.md)
- Persona, voice, session flow: [docs/MARTHA_PERSONA.md](docs/MARTHA_PERSONA.md)
- Scope, ownership, QA gates, demo: this file (synthesised from the MVP Roadmap v1.1)
- Current status & history: [HANDOFF.md](HANDOFF.md)

---

## 📍 Handoff — pick up here (last updated 2026-06-27)

> **Read this before starting.** Each phase below is tagged ✅ done / 🟡 partial /
> 🔨 to build. **Do not redo ✅ items** — verify them with the commands below
> instead. When you finish work, update the relevant tags and this date.

**Already done (verify, don't repeat):**
- Dataset migrated to the 4-level tree + a `metadata.json` in all class folders
  + exam-bank stubs (now incl. the `basic_science` JSS tree). Verify:
  `python rag/scaffold_metadata.py --check` ("All metadata.json files present and current").
- SQLite FTS5 RAG with standard/tiered/remediation/revision retrieval, in both
  Python and Rust. Verify: `python rag/ingest.py --curriculum nigerian --reset`
  then `python rag/query.py -c nigerian -s mathematics -l jss3 "solve for x"`;
  and `cd src-tauri && cargo test --lib rag` (2 tests pass).
- Config: `skoolbox-config.json` + `curriculum/<name>.system_prompt.txt`.
- **Persona consolidated to ONE source** (`curriculum/nigerian.system_prompt.txt`):
  Rust compiles it in via `include_str!` (`agent_prompt.rs`), and
  `Martha.Modelfile` is generated from it by `curriculum/generate_modelfile.py`.
  Verify: `python curriculum/generate_modelfile.py --check` + `cargo test --lib`.
- **Cloud TTS removed** for the offline build (`src/lib/tts/azureTTS.ts` deleted;
  Azure config stripped from stores/Settings/mockData). Verify: `grep -rni azure src/`
  returns only comments; `npx tsc --noEmit` is clean.
- **CI guards + Git LFS:** `.github/workflows/ci.yml` (metadata + Modelfile sync +
  `cargo test` + `tsc` as hard gates; clippy/eslint non-blocking until cleaned up)
  and `.gitattributes` (LFS for `*.gguf`/`*.onnx`/model `*.bin`).
- **Textbook ingestion pipeline** (`rag/ingest_textbook.py` + `.txt` support in
  `rag/ingest.py`): OCR a scanned book/past-questions → reviewable text artifact
  in the class folder → indexed as `source_type='textbook'`. Verify with the
  `.txt` path: drop a `.txt` in a class folder, `rag/ingest.py`, then `rag/query.py`.
- Docs: this file, [docs/CURRICULUM_ARCHITECTURE.md](docs/CURRICULUM_ARCHITECTURE.md),
  [docs/MARTHA_PERSONA.md](docs/MARTHA_PERSONA.md).

**Immediate next task (start here):**
1. **Phase 1 — content (critical path).** Two complementary routes now exist:
   (a) subject experts write Q&A examples toward the 800+ target (fine-tunes the
   teaching *style*); (b) ingest real **textbooks/past-questions** via
   `rag/ingest_textbook.py` (grounds Martha's *knowledge* via RAG — no retraining).
   The `basic_science` JSS tree exists with scaffolded (empty) metadata. Unblocks
   Phases 2–3.
2. **Finish Phase 0 polish:** make clippy/eslint hard gates by clearing the
   pre-existing warnings (see CI `continue-on-error` steps); compile out / dev-gate
   the `claude` provider for release builds; run `git lfs install` on dev machines.

**Biggest unbuilt chunk:** Phase 4 (voice — Whisper STT + neural TTS). No STT
exists yet; pick the TTS engine (Kokoro vs Piper) before starting.

**Open decisions not yet made:** TTS engine (Phase 4); whether to keep the
adapted persona doc or the verbatim spec.

---

## Guiding principles (do not violate)

1. **Fully offline.** No feature may require the internet at runtime. Auto-update
   *checks* a manifest but degrades gracefully with no connection.
2. **Architecture does the work, not the model.** The folder tree + `metadata.json`
   + retrieval filter decide what the LLM sees (CURRICULUM_ARCHITECTURE.md §1).
3. **SQLite, not ChromaDB.** Retrieval is SQLite FTS5 (BM25) with metadata
   filtering + tiered weighting — single bundled file, zero extra runtime deps.
   Implement the spec's *semantics*, not its ChromaDB/BGE-M3 stack
   (CURRICULUM_ARCHITECTURE.md §5).
4. **Teacher-led, projector-first.** The teacher drives from the keyboard; the
   projector is the student-facing display. Large fonts, high contrast, readable
   at 6 m.
5. **Voice is push-to-activate** (spacebar), never wake-word, for MVP.
6. **Production quality:** one source of truth per concern, on-demand model
   loading to stay under RAM budget, clean Windows installer, signed/versioned
   releases, tests that gate merges.
7. **Rule:** if it does not affect the classroom demo, it is post-MVP.

**MVP subjects:** Mathematics, English Language, Basic Science (Integrated
Science at JSS) — only these three. **Curriculum:** Nigerian only.

## Status legend
✅ done · 🟡 partial · 🔨 to build · ⛔ blocked

---

## Phase 0 — Foundation & production hygiene  🟡
*Owner: lead dev · do this before/at the start of everything else.*

The scaffolding exists; this phase removes the production debt that would
otherwise compound through later phases.

- ✅ Monorepo + 4-level `dataset/<curriculum>/<subject>/<phase>/<class>/` tree.
- ✅ `metadata.json` contract + generator (`rag/scaffold_metadata.py`, `--check`).
- ✅ `skoolbox-config.json` (active curriculum + RAG retrieval modes).
- ✅ SQLite FTS5 schema mirrored in `rag/ingest.py` and `src-tauri/src/db/connection.rs`.
- ✅ **Persona consolidated to ONE source.** `curriculum/nigerian.system_prompt.txt`
  is now the only source: Rust compiles it in via `include_str!`
  (`agent_prompt.rs::master_system_prompt()`), and `src-tauri/ai/Martha.Modelfile`
  is generated from it by `curriculum/generate_modelfile.py` (`--check` in CI).
  (Runtime per-curriculum variants are deferred to v2.0 — MARTHA_PERSONA.md §6.)
- 🟡 **Remove cloud paths for offline build.** ✅ `src/lib/tts/azureTTS.ts` deleted
  and Azure config stripped from stores/Settings/mockData; `model_provider` already
  defaults to `ollama`. 🔨 remaining: compile out / dev-gate the `claude` provider
  in release builds.
- 🟡 **CI guards:** ✅ `.github/workflows/ci.yml` runs `scaffold_metadata.py --check`,
  `generate_modelfile.py --check`, `cargo test`, and `tsc` as hard gates. 🔨 remaining:
  `cargo clippy -- -D warnings` and `npm run lint` run non-blocking (`continue-on-error`)
  until the pre-existing warnings/errors are cleared, then flip them to hard gates.
- 🟡 **Git LFS:** ✅ `.gitattributes` tracks `*.gguf`, `*.onnx`, and model `*.bin`.
  🔨 remaining: `git lfs install` on each dev machine (git-lfs not yet installed locally).

**Done when:** persona has one source; release build has zero network calls;
CI fails on missing metadata, failing tests, or clippy warnings.

---

## Phase 1 — Dataset foundation  🟡  (Weeks 1–2)
*Owner: subject experts + curriculum reviewer; lead dev for metadata.*
Ref: CURRICULUM_ARCHITECTURE.md §3, §7; [dataset/README.md](dataset/README.md).

Quality over quantity. Three subjects only.

| Deliverable | Target | Owner |
| --- | --- | --- |
| Mathematics (Primary 5, JSS1–3, SS1–3) | 300+ examples | Maths expert |
| English (JSS1–3, SS1–3) | 300+ examples | English expert |
| Basic Science (JSS1–3) | 200+ examples | Science expert |
| `metadata.json` in every covered class folder | all folders | lead dev (`scaffold_metadata.py`) |
| Merged + validated | 800+ clean examples | ML dev |

- ✅ Add the **Basic Science** subject tree (`dataset/nigerian/basic_science/jss/jss1..3/`)
  + run `scaffold_metadata.py` (metadata + JSS3 exam-bank stub scaffolded; `topics`/
  `textbooks` arrays still to be filled by subject experts).
- 🔨 Fill `topics` and `textbooks` arrays in each `metadata.json` by hand
  (scaffolder seeds the rest).
- 🔨 Write examples per the JSONL chat format + quality checklist
  (≥80-word answers, Nigerian context, single line, level-appropriate).
- 🔨 `python training/merge_dataset.py --input dataset/ --strict` passes; 20-example
  random sample reviewed by a subject expert.

**Done when:** ≥800 clean validated examples across the 3 subjects; every covered
class folder has a complete `metadata.json`; merge runs clean.

---

## Phase 2 — RAG knowledge base (SQLite FTS5)  🟡  (Weeks 2–3)
*Owner: ML / data dev.* Ref: CURRICULUM_ARCHITECTURE.md §4–5; [rag/README.md](rag/README.md).

Most of this is already built — finish content + verification.

- ✅ `ingest.py` reads `metadata.json`, indexes JSONL, tags chunks
  (`curriculum/subject/class_level/topic/is_exam_bank`); skips folders without metadata.
- ✅ `query.py` + app implement **standard / tiered / remediation / revision**
  weighting (tiered is ahead of the roadmap — keep it).
- ✅ Rust `rag::search_curriculum_mode` mirrors `query.py`; round-trip + tiered
  tests green.
- 🔨 Ingest the full Phase-1 dataset into `src-tauri/curriculum.db`
  (`python rag/ingest.py --curriculum nigerian --reset`).
- 🔨 Verification suite (run by ML dev + subject expert): 10 test queries per
  subject return correct-level content; cross-subject isolation holds.
  - `python rag/query.py -c nigerian -s mathematics -l jss2 "what is a linear equation"` → only JSS2 Maths.
  - English query returns no Mathematics; SS3 Physics returns only SS3 Physics.
- ✅ **Textbook / past-question ingestion pipeline.** `rag/ingest_textbook.py`
  turns a scanned PDF, page images, or `.txt`/`.md` into a cleaned text artifact
  in the class folder (OCR via Tesseract for scans; digital-PDF text layer used
  directly). `rag/ingest.py` then indexes any `*.txt` in a class folder as
  `source_type='textbook'` (or `past_questions`), so the shipped `curriculum.db`
  stays reproducible from `dataset/`. OCR deps: `rag/requirements-ocr.txt`.
  🔨 remaining: actually scan/ingest real NERDC textbooks + past-question banks
  (Phase 1/D content — needs the books + a rights check).

> SQLite note: there are **no ChromaDB "collections."** The spec's
> `{curriculum}_{subject}_{class}` collections map to **metadata-filtered FTS
> queries** over one table — same isolation, one file, no vector service.

**Done when:** the app DB is built from real data and the 10-query-per-subject
verification passes with correct-level, correctly-isolated results.

---

## Phase 3 — Martha model + persona  🟡  (Weeks 2–3)
*Owner: ML dev + qualified Nigerian teacher.* Ref: MARTHA_PERSONA.md §1–2.

- 🔨 **Pull Qwen3 4B Q4_K_M GGUF** into `src-tauri/ai/models/` (today's runtime
  falls back to `qwen2.5` — see HANDOFF). Confirm it loads in Ollama.
- 🔨 Finalise the persona in `curriculum/nigerian.system_prompt.txt` (Phase 0
  consolidation) — must encode: class-collective address, Nigerian grounding,
  step-by-step working, end check-in, warm off-curriculum redirect, level match,
  opening greeting + closing recap behaviour.
- 🔨 **Persona reviewed and signed off by a qualified Nigerian classroom teacher.**
- 🔨 `ollama create martha -f src-tauri/ai/Martha.Modelfile` builds cleanly (SYSTEM
  sourced from the one persona file).
- 🔨 Manual persona tests: Primary 5 (simple, encouraging), JSS2 (NERDC + Nigerian
  examples), SS3 (WAEC style, full working); off-curriculum → warm redirect every
  time; **never** says "I am an AI" across 20 queries.
- 🔨 RAM with LLM only on an 8 GB device **< 3 GB**.

**Done when:** Martha feels like a teacher at all three sample levels, redirects
warmly, never breaks character, and the persona has teacher sign-off.

---

## Phase 4 — Voice integration  🔨  (Weeks 3–4)
*Owner: ML dev + app dev; QA for the noise test.* Ref: MARTHA_PERSONA.md §3.

Largest net-new build. Today: no STT; TTS is `spd-say`/espeak (replace) + cloud
azureTTS (remove). **Decision to lock first:** TTS engine = Kokoro (per spec) vs.
Piper — both offline ~300 MB; default Kokoro unless Piper wins on target hardware.

**STT — Whisper Small (~250 MB):**
- 🔨 Bundle model in `src-tauri/ai/models/`.
- 🔨 Spacebar activates Whisper; pulsing mic icon visible on projector; 30 s cap.
- 🔨 Transcription shown on projector **before** Martha responds (teacher confirms).
- 🔨 Whisper unloads within ~2 s of transcription (RAM returns to baseline).
- 🔨 Failed transcriptions logged to a local file (future NG-English fine-tune).

**TTS — neural (~300 MB):**
- 🔨 Replace `tts.rs` espeak path with the neural engine; reuse the existing
  `clean_for_speech` math/markdown normalisation.
- 🔨 Default voice `warm_female_en` @ `0.92×`, routed to system default output.
- 🔨 **Escape** interrupts playback instantly, every time.
- 🔨 Engine unloads within ~2 s of playback ending.

**RAM safety & fallback:**
- 🔨 Whisper and TTS **never loaded simultaneously** (enforce in code; verify in review).
- 🔨 Peak (LLM + Whisper) < 4 GB; full session < 6.5 GB on 8 GB device.
- 🔨 **Voice auto-disables when available RAM < 6 GB** → clear text-only message.
- 🔨 Tested by a Nigerian speaker in a **noisy** room: 10/10 teacher phrases correct.

**Done when:** push-to-activate → preview → spoken+displayed reply → Escape works
reliably in classroom noise, within the RAM budget, with a clean text-only fallback.

---

## Phase 5 — Tauri classroom app  🟡  (Weeks 4–6)
*Owner: app dev.* Ref: MARTHA_PERSONA.md §2; existing `src/pages/ClassSessionPage.tsx`,
`src-tauri/src/ai/classroom.rs`, `commands/classroom.rs`.

Session flow exists in part; finish the teacher-led, projector-first experience.

- 🔨 **First-launch curriculum selection** → writes `skoolbox-config.json`
  (Nigerian active). Foundation for v2.0 multi-curriculum.
- 🔨 **Session setup < 60 s:** subject + class level + topic; if topic missing,
  Martha asks "What are we learning about today?" before proceeding.
- 🔨 **Opening greeting** displayed + spoken (names subject + today's topic).
- 🔨 **Projector display:** large font, high contrast, readable from 6 m.
- 🔨 Push-to-activate mic icon + transcription preview (wires Phase 4).
- 🔨 **Response displayed AND spoken simultaneously.**
- 🔨 On-demand teacher commands (route through `classroom.rs`, grounded via RAG):
  explain to class · quiz (3–5 Qs, shown + read aloud, pause for response) ·
  re-explain for a named student · prerequisites for a topic · generate class notes.
- 🔨 **Lesson note generator:** objectives, key points, examples, homework.
- 🔨 **Quiz generator:** questions on projector, Martha reads each aloud.
- 🔨 **Session end summary:** topics covered, questions asked, key concepts,
  homework, topics to revisit — saveable/printable.
- 🔨 Re-route or retire orphaned `TeachPage` / `PresentationPage` (HANDOFF gap).

**Done when:** a teacher can configure and run a full lesson (greeting → explain →
quiz → notes → summary) entirely from the keyboard, projector-readable and offline.

---

## Phase 6 — QA & real-classroom testing  🔨  (Weeks 6–7)
*Owner: whole team + pilot teacher.* **Must include a real classroom test**
(projector, speakers, background noise) — a quiet office is insufficient.

Gating checks:
- Persona: never robotic across 20 questions (teacher reviewer).
- Curriculum accuracy: 10/10 JSS2 Maths and 10/10 SS1 English correct + aligned.
- Voice in real classroom noise: 10/10 teacher phrases transcribed.
- Projector readable + audio audible at 6 m (back row).
- Push-to-activate: zero missed triggers; Escape interrupts reliably.
- RAM during full 8 GB session never exceeds 7 GB; 4 GB device → text-only, no crash.
- Offline: WiFi off, everything works.
- Lesson notes usable without editing; quiz answers factually correct.
- Clean install on fresh Windows 10 **and** 11 in < 5 min; installer < 5 GB.

---

## Phase 7 — Demo preparation  🔨  (Weeks 7–9)
*Owner: Victor + team.* Simulate a real classroom; run in an actual school if possible.

- 🔨 3-minute demo script rehearsed (covers all 5 checkpoints below).
- 🔨 Backup demo video (screen + audio) on a clean device.
- 🔨 Demo hardware tested: laptop + USB mic + projector.
- 🔨 Clean-device dry run: fresh laptop → install → full session → no errors.
- 🔨 At least one pilot school agreement.
- 🔨 One-page exec summary: problem, Martha, traction, team, ask.

### The 5 investor checkpoints (must work every time)
1. **Offline** — unplug internet; JSS2 Maths answer in < 3 s.
2. **Knows the curriculum** — same topic at Primary 5 vs JSS2; depth/examples
   adapt; naira + Nigerian names in both.
3. **Lesson note** — JSS1 Basic Science water-cycle note in ~10 s.
4. **Quiz** — 5 JSS2 linear-equation Qs with answers, shown + read aloud.
5. **Installs in minutes** — fresh Windows laptop → Martha on projector in < 5 min.

---

## Cross-cutting: packaging & release  🔨
- Bundle GGUF + voice models via Git LFS; on-demand load to respect RAM budget.
- `manifest.json` over HTTPS for auto-update *check*; handle no-internet gracefully.
- Windows `.exe` installer < 5 GB; first run seeds the curriculum pack + DB.
- Version releases (`v1.0`, `v1.1`…); keep `src-tauri/curriculum.db` reproducible
  from `dataset/` via the rag scripts (never hand-edit the shipped DB).

## Definition of MVP done
Martha installs on a clean Windows laptop in < 5 min, runs in a real classroom on
the projector, answers teacher questions **offline** in < 3 s, speaks clearly
through classroom speakers, generates a lesson note and a quiz on demand, and at
least one school agrees to pilot her.

## Post-MVP (tracked, do not build for MVP)
LoRA fine-tune on real classroom data (v1.1, after 1,000+ pilot questions) ·
Nigerian-English Whisper + voice (v1.1) · wake word "Hey Martha" (v1.1) ·
embedding reranking on top of FTS5 if recall gaps appear (see HANDOFF Phase E) ·
admin voice library (v2.0) · individual student mode, session memory, analytics
(v1.2) · British/American curricula, mobile (v2.0).
