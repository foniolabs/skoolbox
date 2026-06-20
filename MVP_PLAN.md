# SkoolBox MVP Plan — Multi-Curriculum AI Tutor & Teaching Co-Pilot

> **Status:** draft for refinement (2026-06-20). Supersedes the MVP sequencing in
> [HANDOFF.md](HANDOFF.md). The offline engine, dataset, training, and RAG work
> already done all carry forward.

## 0. Positioning — a hybrid: AI tutor + teaching co-pilot

SkoolBox/Martha is a **hybrid** that serves two audiences:

- **Student-facing AI tutor** — a student can ask Martha a question **directly**
  and get a curriculum-grounded answer, explanation, or practice help, with no
  teacher in between.
- **Teacher-facing co-pilot (teaching assistant)** — Martha drafts lesson notes,
  lesson plans, textbook content and quizzes that the teacher **reviews, edits and
  approves** before use.

So Martha **works directly for the student** *and* **works with the teacher**
(without replacing them). The key distinction: **some tasks the AI does directly**
(live student Q&A, explanations, answer feedback) and **some are teacher-driven
artifacts the teacher approves** (the teaching materials in Phases 2–4).
Teacher-in-the-loop applies to *published teaching materials* — not to live
student tutoring, which is direct. Everything is grounded in the school's active
curriculum (§3).

### 0.1 Who does what

| Capability | Audience | Driven by | Teacher approval |
| --- | --- | --- | --- |
| Ask Martha / direct Q&A | Student | Student → AI (live) | No |
| Concept explanations, worked examples | Student | Student → AI (live) | No |
| Practice attempts + instant feedback / grading | Student | Student → AI (live) | No |
| Lesson note generation | Teacher | Teacher → AI draft | **Yes** — review/edit |
| Lesson plan / scheme of work | Teacher | Teacher → AI draft | **Yes** |
| Textbook content | Teacher | Teacher → AI draft | **Yes** |
| Quiz / assessment authoring | Teacher | Teacher → AI draft | **Yes** |
| Curriculum selection & document ingestion | Teacher / Admin | Teacher (setup) | n/a |

## 1. Decisions locked this session

| Decision | Choice |
| --- | --- |
| Curriculum capability | **Selector + document ingestion** (teacher picks a curriculum AND uploads official docs Martha reads/auto-detects) |
| Curriculum accuracy mechanism | **LoRA fine-tune per curriculum** (target/quality path) |
| Curriculum selection scope | **Per school** (one active curriculum per installation, in settings) |
| Curriculum coverage | **All three** — Nigerian, British, American |
| Build order | **Curriculum → Lesson Note → Lesson Plan → Textbook** |

## 2. The fine-tuning ↔ MVP sequencing (the one to confirm)

Fine-tuning per curriculum needs thousands of examples per curriculum + GPU runs.
At MVP time only Nigerian has seed data (~113 examples); British/American have
none. Therefore:

- **MVP ships curriculum-accurate via:** the curriculum data model + document
  ingestion + **RAG grounding** + curriculum-aware prompts. Works for all three
  immediately, fully offline, no GPU.
- **Per-curriculum LoRA is the maturation track:** fed by the `dataset/` pipeline
  (already built), rolled out one curriculum at a time as each dataset crosses
  ~5,000 examples. Restructure `dataset/<curriculum>/<subject>/<level>/...`.

This keeps "fine-tune per curriculum" as the destination while letting the MVP
actually ship one step at a time. **ADOPTED** — MVP is RAG-grounded for all three
curricula; per-curriculum LoRA is the maturation track fed by `dataset/`.

## 3. Curriculum as a first-class concept

The three curricula differ structurally, so curriculum cannot be hardcoded:

| | Nigerian | British | American |
| --- | --- | --- | --- |
| Authority | NERDC / WAEC / NECO | National Curriculum | Common Core / state standards |
| Levels | Primary 1–6, JSS 1–3, SS 1–3 | Years 1–13, Key Stages KS1–KS4 (GCSE, A-Level) | Grades K–12 |
| Subject naming | "English Studies", "Mathematics", "Basic Science" | "English", "Maths", "Science" | "English Language Arts", "Math", "Science" |
| Assessment style | WAEC/NECO exam format | GCSE/A-Level | grade-level standards |

**New data model (extends [connection.rs](src-tauri/src/db/connection.rs)):**

```
curricula(id, key[nigerian|british|american], name, authority, active)
curriculum_levels(id, curriculum_id, key, name, order_index, stage)
curriculum_subjects(id, curriculum_id, key, name)
curriculum_standards(id, curriculum_id, subject_id, level_id, code, title, description)
settings: active_curriculum   -- per installation (per school)
```

All curriculum content (subjects, levels, standards) loads from these tables, so
existing flows stop hardcoding Nigerian JSS/SS and instead read the active
curriculum.

## 4. Curriculum ingestion + auto-detection

- Extend ingestion (`rag/ingest.py` + the app's `commands/knowledge.rs`) to tag
  every document with `curriculum_id`; add `curriculum_id` to `curriculum_fts`
  and scope retrieval by curriculum + subject + level.
- **Auto-detect** the curriculum of an uploaded document with a lightweight,
  offline keyword classifier (e.g. "NERDC"/"WAEC" → Nigerian; "Key
  Stage"/"GCSE"/"National Curriculum" → British; "Common Core"/"CCSS"/"Grade" →
  American), then **ask the teacher to confirm**.

## 5. MVP build order (phased)

Two tracks run on the same curriculum foundation: the **student-facing tutor**
(direct Q&A — already built; Phase 1 makes it curriculum-aware) and the
**teacher-facing co-pilot outputs** (Phases 2–4). Both ground every answer in the
active curriculum.

### Phase 1 — CURRICULUM (the foundation) 🎯 first
1. Data model + migrations (§3) and `active_curriculum` setting.
2. **Curriculum selector** in school setup/settings (choose & switch active curriculum).
3. Seed all 3 **curriculum frameworks** (levels / subjects / strands) as structured packs.
4. **Curriculum document ingestion + auto-detect** (tag by `curriculum_id`; RAG scoped).
5. Make existing flows **curriculum-aware** (subjects/levels come from active curriculum).
6. Make the **student tutor curriculum-aware** — Martha's direct Q&A answers are
   grounded in the active curriculum (scoped RAG + persona), so the same question
   gets a Nigerian / British / American-appropriate answer.

### Phase 2 — LESSON NOTE (co-pilot output #1)
- Generate a curriculum-aligned **lesson note** for a chosen subject/level/topic,
  grounded in ingested curriculum + textbook content; teacher edits/approves/saves.

### Phase 3 — LESSON PLAN
- Structured **scheme/plan** (objectives, materials, steps, assessment) aligned to
  curriculum standards; teacher-in-the-loop.

### Phase 4 — TEXTBOOK
- Generate/assemble **textbook-style content** per topic (longer-form), grounded
  in curriculum + ingested sources; teacher reviews.

Each phase: backend command(s) via `provider::generate_json` + scoped RAG → TS
bindings → co-pilot UI (draft → edit → regenerate → approve → save) →
exportable in curriculum packs.

## 6. Reuse from what's already built

- **Offline engine:** `provider.rs` (Ollama/Qwen), `json.rs` (validated JSON),
  `ollama.rs`. No change to the offline-first posture.
- **RAG:** `rag.rs` retrieval + `rag/ingest.py`/`rag/query.py` — extend with
  `curriculum_id` scoping.
- **Distribution:** curriculum packs (export/import) carry curriculum frameworks,
  ingested docs, and baked outputs.
- **Pre-generated ("baked") outputs:** bake notes/plans/textbook on capable
  hardware, play instantly offline — still the answer to slow CPU generation.
- **Dataset pipeline:** reorganize to per-curriculum folders for later fine-tuning.

## 7. Resolved decisions

1. **Fine-tuning sequencing** — RAG-grounded MVP now (all three curricula);
   per-curriculum LoRA is the maturation track. (§2)
2. **Lesson note vs lesson plan** — keep the stated order. **Lesson plan** = the
   structured scheme of work (objectives, prior knowledge, materials, presentation
   steps, evaluation, assignment — Nigerian "lesson note" format). **Lesson note**
   = the fuller written teaching content the teacher delivers. They share the same
   curriculum-aligned objectives; the note expands the plan's outline.
3. **Textbook** — **hybrid**: ground in ingested textbook/curriculum content via
   RAG first, and generate explanatory prose to fill gaps, always curriculum-aligned
   (avoids hallucination, reuses sources).
4. **British/American content** — **seed from the published frameworks** now
   (levels, subjects, representative standards: NC programmes of study, Common
   Core / NGSS). Official source documents are ingested later via the curriculum
   ingestion flow. Frameworks live in [`curriculum/`](curriculum/).
5. **Setting the school curriculum** — **both**: a first-run setup step picks the
   active curriculum, and a settings page allows switching it later.

## 8. Curriculum framework data

The three curriculum frameworks (levels, subjects, representative standards) are
authored as structured JSON in [`curriculum/`](curriculum/) — one file per
curriculum. The app seeds its `curricula` / `curriculum_levels` /
`curriculum_subjects` / `curriculum_standards` tables (§3) from these on first run.
Validate them with `python curriculum/validate.py`.
```
