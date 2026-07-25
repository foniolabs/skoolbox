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

## 📍 Handoff — pick up here (last updated 2026-07-18)

> **Read this before starting.** Each phase below is tagged ✅ done / 🟡 partial /
> 🔨 to build. **Do not redo ✅ items** — verify them with the commands below
> instead. When you finish work, update the relevant tags and this date.

**Already done (verify, don't repeat):**
- **Online reviewer portal — LIVE (2026-07-20):** academics review the dataset in
  a browser and their verdicts sync back to the sign-off ledger. Stack: Cloudflare
  Pages + D1 (SQLite), in `reviewer/`. Reviewer app `reviewer/public/index.html`
  (branded to the SkoolBox palette: white, Inter UI + Source-Serif answers, no
  emoji; keyboard A/X marking, draft autosave); admin dashboard
  `reviewer/public/admin.html` at **`/admin`** (token-gated; flagged examples shown
  with their answer + reviewer note). API in `reviewer/functions/api/` (submit /
  progress / verdicts / submissions). `training/review.py` gained `export` (writes
  `reviewer/public/dataset.json`) and `pull --url <portal> --token <ADMIN_TOKEN>`
  (folds submissions into `dataset/reviews.json`; ignores stale-hash verdicts).
  Live at `https://skoolbox-review.pages.dev` (custom domain `review.skoolbox.xyz`
  to be attached). Setup + troubleshooting: `reviewer/README.md`. **First real
  submission already in** (SS1 English concord, 1 flagged). ⚠️ Two ops steps still
  on the user: set the `ADMIN_TOKEN` secret (else `/api/verdicts`+dashboard are
  open), and clear the one test row from prod D1. Verify: `curl <url>/api/health`.
- **Answer formatting pass (2026-07-20):** `training/reformat_answers.py` broke the
  dense single-paragraph answers into step-per-line / list-per-line structure (the
  app renders answers `white-space: pre-wrap`, so this reaches the whiteboard and
  lesson notes, not just the reviewer). 79/427 answers reformatted; wording
  unchanged (whitespace only); `merge_dataset --strict` still clean. Re-run
  `review.py export` + redeploy the portal after any dataset change.
- **Phase 0 closed + Phase 5 classroom wave (2026-07-10):** `claude` provider
  compiled out of release builds; clippy + eslint now **hard CI gates** (both
  clean); orphaned Teach/Presentation pages retired. Classroom got: opening
  greeting (spoken + skippable), on-demand teacher commands (explain /
  re-explain-for-student / prerequisites / quiz read aloud / lesson note),
  projector-mode toggle, Escape-stops-voice, and a saveable session-end summary.
  Verify: `cargo clippy --lib --all-targets -- -D warnings`, `npm run lint -- --max-warnings 0`,
  `cargo test --lib` (9 pass), `npx tsc --noEmit`, `cargo check --release`.
  Phase 0 leftover: `git lfs install` still not run on this machine (git-lfs not installed).
- **JSS1 full-level wave + reviewer sign-off tooling (2026-07-18):** JSS1
  Mathematics (whole numbers topped up to 12, plus fractions, algebraic
  processes, geometry — 36) and JSS1 English (parts of speech topped up to 12,
  plus sentences, tenses, comprehension and composition — 36) joined the
  existing JSS1 Basic Science 32, so **JSS1 is now covered across all three MVP
  subjects**. Dataset: **427 clean examples**, 598+ chunks re-ingested.
  **New: `training/review.py`** — the curriculum reviewer's workflow.
  `packet` builds a printable HTML review document (grouped by file, every
  example tagged `file:line`); `sign` records approve / changes_requested with
  reviewer + date + notes + a SHA-256 of the approved content; `status` reports
  approved / pending / stale / changes-requested, and `--strict` is the
  pre-training gate. Editing an approved file auto-marks it STALE. Ledger:
  `dataset/reviews.json`. Process documented in dataset/REVIEW_CHECKLIST.md.
  ⚠️ **0 of 427 examples are signed off** — that backlog is the real gate
  before any training run.
- **JSS2 Maths + JSS1 Basic Science wave (2026-07-18):** the two investor-demo
  levels. JSS2 Mathematics now has 5 topics (linear equations topped up to 12
  examples, plus algebraic expressions, directed numbers, angles and polygons,
  statistics — 44 total); JSS1 Basic Science has 4 topics (water cycle, living
  and non-living things, matter, energy — 32 total). Both `metadata.json` files
  now list real topics + textbooks. Dataset: **363 clean examples** (merge
  --strict passes, 0 warnings); re-ingested → 598 chunks; retrieval verified for
  "x on both sides" (JSS2) and "stages of the water cycle" (JSS1).
  ⚠️ AI-drafted — still needs curriculum-reviewer sign-off before training.
- **Primary 4 content wave (2026-07-09):** NERDC Sept-2025 revised curriculum
  scope docs added under `curriculum_sources/` and as `curriculum_scope.txt`
  RAG artifacts in the four Primary 4 class folders; two new subject trees
  (`basic_science_technology`, `social_studies`) with topics/textbooks filled;
  20 new topic `.jsonl` files (~160 examples) across Maths / English / BST /
  Social Studies Primary 4. Dataset now **291 clean examples** (merge --strict
  passes, 0 warnings); re-ingested → 526 chunks; retrieval verified per subject.
  ⚠️ AI-drafted examples — **needs curriculum-reviewer sign-off** before a
  training run (REVIEW_CHECKLIST.md). Note: these two subjects extend the
  3-subject MVP rule below — confirm scope or keep them as RAG-only content.
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
2. **Phase 0 is closed** (clippy/eslint hard gates, `claude` provider dev-gated)
   except one local step: install git-lfs and run `git lfs install` on dev machines.

**Biggest unbuilt chunk:** Phase 4 voice. **TTS engine decision locked
(2026-07-10): Kokoro.** The engine is already wired: `tts.rs` prefers Kokoro →
Piper → `spd-say`, discovering `koko` + models under
`~/.local/share/com.foniolabs.skoolbox/tts/kokoro/`; run
`scripts/setup_voice.sh` once per machine (needs `sudo apt-get install
pkg-config libopus-dev` for the one-time `koko` build; `--with-whisper` also
fetches the STT model + builds whisper-cli). **STT push-to-talk is now built**
(2026-07-10): `commands/stt.rs` (record via arecord/pw-record/parecord →
whisper-cli → transcript; 30 s cap; <6 GB RAM auto-disable; failed-transcription
log) + `PushToTalk.tsx` wired into the class question phase. Remaining: install
voice deps per machine (`sudo apt-get install pkg-config libopus-dev cmake`,
then `bash scripts/setup_voice.sh --with-whisper`), voice style/speed tuning
(warm female @ 0.92×), noisy-room test, RAM measurements on target hardware.

**Open decisions not yet made:** whether to keep the adapted persona doc or the
verbatim spec.

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

## Phase 0 — Foundation & production hygiene  ✅ (bar `git lfs install` locally)
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
- ✅ **Remove cloud paths for offline build.** `src/lib/tts/azureTTS.ts` deleted
  and Azure config stripped from stores/Settings/mockData; `model_provider`
  defaults to `ollama`; the `claude` provider is now **compiled out of release
  builds** (`#[cfg(debug_assertions)]` in `ai/provider.rs` + `ai/mod.rs` —
  release ignores a leftover `claude` setting and stays offline). Verified with
  `cargo check --release`.
- ✅ **CI guards:** `.github/workflows/ci.yml` runs `scaffold_metadata.py --check`,
  `generate_modelfile.py --check`, `cargo test`, `tsc`, **`cargo clippy -- -D
  warnings` and `eslint --max-warnings 0` — all hard gates** (warnings/errors
  cleared 2026-07-10; dead structs removed, hooks deps fixed).
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

## Phase 4 — Voice integration  🟡  (Weeks 3–4)
*Owner: ML dev + app dev; QA for the noise test.* Ref: MARTHA_PERSONA.md §3.

Largest net-new build. Today: no STT. **TTS engine locked (2026-07-10): Kokoro**
(~340 MB: kokoro-v1.0.onnx + voices-v1.0.bin). 🟡 already wired: `tts.rs` engine
order Kokoro → Piper → `spd-say`; install via `scripts/setup_voice.sh`.

**STT — Whisper Small:**
- 🟡 Model + engine install: `scripts/setup_voice.sh --with-whisper` downloads
  `ggml-small.bin` and builds `whisper-cli` (static) into
  `~/.local/share/com.foniolabs.skoolbox/stt/` (runtime-discovered like TTS,
  not bundled in `src-tauri/ai/models/`). 🔨 remaining: run it on each machine
  (needs `sudo apt-get install pkg-config libopus-dev cmake` first).
- ✅ Spacebar toggles recording (`PushToTalk.tsx`, ignores keys while typing);
  pulsing red mic + countdown visible on projector; **30 s cap** (frontend
  countdown + `arecord -d 31` backstop).
- ✅ Transcription lands in the answer box **before** Martha responds — the
  teacher previews/edits, then presses Check to confirm (`commands/stt.rs`).
- ✅ Whisper runs as a transient process per transcription — exits (frees all
  RAM) immediately; nothing stays resident.
- ✅ Failed/empty transcriptions logged to `stt/failed_transcriptions.log`
  with the WAV kept under `stt/failed/` (future NG-English fine-tune).

**TTS — neural (Kokoro, ~340 MB):**
- ✅ Replace `tts.rs` espeak path with the neural engine: Kokoro is the
  preferred engine (`speak_with_kokoro`, reuses `clean_for_speech`); installed
  by `scripts/setup_voice.sh`. **Verified working end-to-end 2026-07-10**
  (koko → WAV → paplay; ~3 s synthesis for a 5 s line on the dev CPU; Whisper
  transcribes the output word-for-word). ⚠️ gotcha: koko needs
  `espeak-ng-data/` shipped beside it + `ESPEAK_DATA_PATH` set (both handled by
  the script and tts.rs) — without it, it silently emits ~0.4 s stub audio; the
  script's smoke test now fails on stub-sized output. 🔨 consider koko
  server/stream mode if per-call latency bothers in class.
- 🟡 Default voice: **af_heart @ 0.92×** set in `speak_with_kokoro` (matches the
  spec's warm female). 🔨 remaining: Nigerian teacher listens and signs off.
- ✅ **Escape** interrupts playback instantly (global handler in the class screen
  → `stop_speaking`, which kills the audio process).
- 🟡 Engine unloads: the CLI approach holds no resident model between calls
  (nothing to unload); revisit if we move to server mode.

**RAM safety & fallback:**
- ✅ Whisper and TTS **never loaded simultaneously**: both are transient
  processes, and `stt_start` stops any Martha speech before recording.
- 🔨 Peak (LLM + Whisper) < 4 GB; full session < 6.5 GB on 8 GB device (measure
  on target hardware once whisper-cli is installed).
- ✅ **Voice auto-disables when available RAM < 6 GB** (`/proc/meminfo`
  MemAvailable check in `stt_available`) → clear "type instead" message.
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
- ✅ **Opening greeting** displayed + spoken (names subject + today's topic),
  skippable; topic missing → Martha asks "What are we learning about today?".
- 🟡 **Projector display:** projector-mode toggle in the class header scales the
  greeting/question/quiz/summary text up. 🔨 remaining: verify at 6 m on real hardware.
- ✅ Push-to-activate mic icon + transcription preview in the question phase
  (`PushToTalk.tsx` — spacebar or click, transcript fills the answer box for
  teacher confirmation).
- 🔨 **Response displayed AND spoken simultaneously.**
- ✅ On-demand teacher commands (`classroom_explain` / `classroom_class_quiz` /
  `classroom_lesson_note` in `commands/classroom.rs`, grounded via RAG;
  `ClassToolsPanel.tsx` in the class screen): explain to class · quiz (3–5 Qs,
  shown + read aloud per question, answers hidden behind a teacher toggle) ·
  re-explain for a named student · prerequisites · lesson note. **Escape stops
  Martha's voice** anywhere in the class screen.
- ✅ **Lesson note generator:** objectives, key points, examples, homework —
  displayed for review + saved as `.txt` (feeds homework into the session summary).
- ✅ **Quiz generator:** questions on projector, Martha reads each aloud.
- ✅ **Session end summary:** topics covered, questions asked (with ✓/✗), homework
  (from the lesson note), topics to revisit (segments answered wrongly) — saveable as `.txt`.
- ✅ Retired orphaned `TeachPage` / `PresentationPage` + their exclusive
  components (`TeachCommandBar`, `ModeSelector`, `QuickCommands`, `RecentLessons`,
  `presentation/`, `narration/`, `useTeachStore`); `/presentation` route removed.
  Baked-lesson replay lives in `ClassSessionPage` (`getGeneratedLesson`).

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
