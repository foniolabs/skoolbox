# SkoolBox Repo Guide — What Every File & Folder Is For

> A map of the codebase so you can find where to look and continue building.
> For *product direction* read [MVP_PLAN.md](MVP_PLAN.md); for *AI-engine status &
> what's left* read [HANDOFF.md](HANDOFF.md); for the *monorepo layout* read
> [MONOREPO.md](MONOREPO.md). This file explains the **files themselves**.

## What SkoolBox is, in one line

An **offline-first desktop app** (Tauri + React + Rust) where **Martha** is a
**hybrid AI**: a **tutor** students ask directly, and a **co-pilot** that drafts
teaching materials for teachers — all aligned to a chosen **curriculum**
(Nigerian / British / American).

## Top-level layout

| Path | What it is | Who works here |
| --- | --- | --- |
| [`src/`](src/) | Tauri app **frontend** — React + TypeScript UI | App devs |
| [`src-tauri/`](src-tauri/) | Tauri app **backend** — Rust (AI engine, DB, commands) | App devs |
| [`curriculum/`](curriculum/) | Curriculum frameworks (levels/subjects/standards) per country | Curriculum experts |
| [`dataset/`](dataset/) | Training examples (`.jsonl`) for fine-tuning | Subject experts |
| [`training/`](training/) | LoRA fine-tuning pipeline (Qwen3 4B → GGUF) | ML devs |
| [`rag/`](rag/) | Curriculum retrieval index builder + tools | RAG/data devs |
| `*.md` (root) | Docs (see below) | Everyone |
| Config files (root) | Build/lint/TS/Tailwind config | App devs |

---

## Root files

| File | Purpose |
| --- | --- |
| [package.json](package.json) | Frontend dependencies + npm scripts (`dev`, `build`, `tauri:dev`, `tauri:build`, `lint`) |
| `package-lock.json` | Locked npm dependency versions |
| [vite.config.ts](vite.config.ts) | Vite bundler config (dev server, build) |
| [index.html](index.html) | HTML entry point Vite mounts the React app into |
| `tsconfig*.json` | TypeScript compiler config (`app`, `node`, base) |
| [tailwind.config.js](tailwind.config.js) | Tailwind CSS theme/config |
| [postcss.config.js](postcss.config.js) | PostCSS (runs Tailwind/autoprefixer) |
| [eslint.config.js](eslint.config.js) | ESLint rules |
| `.env` / `.env.example` | Secrets (API keys); `.env` is gitignored |
| `public/` | Static assets served as-is at the web root |
| `dist/` | Build output (generated; gitignored) |

### Documentation (root `*.md`)

| Doc | What it covers |
| --- | --- |
| [README.md](README.md) | Project overview, setup, run, contributing |
| [PRD.md](PRD.md) | Product requirements |
| [MVP_PLAN.md](MVP_PLAN.md) | The current MVP plan (hybrid tutor + co-pilot, multi-curriculum) |
| [HANDOFF.md](HANDOFF.md) | AI-engine status, what's left, resources, team roles |
| [MONOREPO.md](MONOREPO.md) | Monorepo layout + who-works-where |
| [COLLABORATION.md](COLLABORATION.md) | What's tracked in git vs regenerated; team workflow |
| [REPO_GUIDE.md](REPO_GUIDE.md) | **This file** — what every file/folder is for |

---

## `src/` — Frontend (React + TypeScript)

| Path | Purpose |
| --- | --- |
| [src/main.tsx](src/main.tsx) | React entry point — mounts `<App/>` |
| [src/App.tsx](src/App.tsx) | **Router** — role-based routes (teacher vs student); the source of truth for which pages are live |
| [src/index.css](src/index.css) | Global styles / Tailwind layers |
| [src/vite-env.d.ts](src/vite-env.d.ts) | Vite type declarations |

### `src/components/` — reusable UI, grouped by feature

| Folder | What's inside |
| --- | --- |
| `ai-learn/`, `ai-tutor/` | Student-facing AI tutor chat UI |
| `auth/` | Login/signup widgets |
| `curriculum/` | Curriculum planner widgets (e.g. topic notes) |
| `dashboard/` | Teacher dashboard widgets (proficiency table, student edit modal) |
| `layout/` | App shell — nav bars, layouts (teacher + student) |
| `progress/` | Progress charts |
| `quizzes/` | Quiz builder/player widgets |
| `settings/` | Settings UI |
| `shared/` | Cross-cutting reusable components |
| `subjects/` | Subject grid/browser |
| `teach/` | Lesson presentation + whiteboard (e.g. `EquationWriter`) |
| `topic-learning/` | Topic learn/practice/quiz tabs |

### `src/pages/` — route-level screens

**Teacher pages:** `DashboardPage`, `PreparePage`, `LessonPlannerPage`,
`ClassSessionPage` (the unified 30-min whiteboard classroom, served at `/teach`
and `/classroom`), `PresentationPage`, `AssessPage`, `QuizPlayerPage`,
`MonitorPage`, `EnrollStudentsPage`, `CurriculumLibraryPage` (curriculum-doc
admin/ingestion), `CurriculumPlannerPage`, `TermPlanViewPage`.

**Student pages** ([src/pages/student/](src/pages/student/)): `StudentHomePage`,
`StudentSubjectsPage`, `StudentQuizzesPage`, `StudentProgressPage`,
`TopicLearningPage`.

> ⚠️ **Legacy / not in the current router:** `TeachPage`, `ClassroomPage`,
> `AITutorPage`, `QuizzesPage`, `SubjectsPage`, `ProgressPage`, `TopicPage` appear
> superseded by the pages above (not imported in `App.tsx`). **Confirm against
> [src/App.tsx](src/App.tsx) before building on any page** — App.tsx lists exactly
> what's wired up.

### `src/stores/` — Zustand state (one store per concern)

`useAuthStore`, `useChatStore`, `useProgressStore`, `useQuizStore`,
`useSettingsStore`, `useStudentStore`, `useTeachStore`, `useTTSStore`.

### `src/lib/` — helpers

| File | Purpose |
| --- | --- |
| [src/lib/tauri/commands.ts](src/lib/tauri/commands.ts) | **TypeScript bindings to the Rust backend** — every `invoke()` call lives here. Add a binding here when you add a Rust command. |
| `src/lib/tauri/mockData.ts` | Mock data for web-only dev |
| `src/lib/ai/teachingAssistant.ts` | Offline template lesson generator (fallback when the model is slow) |
| `src/lib/tts/marthaVoice.ts` | Calls the Rust TTS commands (Piper voice) in the app; Web Speech in dev |
| `src/lib/tts/azureTTS.ts`, `browserTTS.ts` | Alternate/older TTS paths |

### `src/data/` — static seed content

Bundled subjects, questions, videos, animations used by the UI.

---

## `src-tauri/` — Backend (Rust / Tauri)

| Path | Purpose |
| --- | --- |
| [src-tauri/Cargo.toml](src-tauri/Cargo.toml) | Rust dependencies + crate config |
| `Cargo.lock` | Locked Rust dependency versions |
| [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) | App config — window, CSP, bundle, **bundled resources** |
| [src-tauri/build.rs](src-tauri/build.rs) | Tauri build script |
| [src-tauri/default_curriculum_pack.json](src-tauri/default_curriculum_pack.json) | Curriculum content seeded on first run |
| `src-tauri/ai/` | `Martha.Modelfile` (Ollama) + bundled model assets |
| `src-tauri/capabilities/`, `icons/`, `gen/` | Tauri permissions, app icons, generated files |

### `src-tauri/src/` — Rust source

| File | Purpose |
| --- | --- |
| [src-tauri/src/main.rs](src-tauri/src/main.rs) | Binary entry point |
| [src-tauri/src/lib.rs](src-tauri/src/lib.rs) | **App setup** — registers all Tauri commands, runs first-run seeding. Start here to see what the backend exposes. |

#### `src-tauri/src/ai/` — the AI engine

| File | Purpose |
| --- | --- |
| `mod.rs` | Module exports |
| [provider.rs](src-tauri/src/ai/provider.rs) | **Backend dispatch** — routes to Ollama (offline) or Claude (cloud) per the `model_provider` setting; `generate_json` (validated JSON). The hub everything calls. |
| [ollama.rs](src-tauri/src/ai/ollama.rs) | Local Ollama client (`localhost:11434`); picks the best installed model; JSON mode |
| [claude_api.rs](src-tauri/src/ai/claude_api.rs) | Cloud Claude client (fallback when online) |
| [martha.rs](src-tauri/src/ai/martha.rs) | Tutor persona facade (`tutor_reply`) — the student-facing tutor |
| [classroom.rs](src-tauri/src/ai/classroom.rs) | Classroom engine — `plan_lesson`, `teach_segment`, `bake_lesson`, `evaluate_answer` |
| [rag.rs](src-tauri/src/ai/rag.rs) | **Curriculum retrieval** — FTS5 search over ingested docs (`search_curriculum`) |
| [chunking.rs](src-tauri/src/ai/chunking.rs) | Splits documents into chunks for ingestion |
| [json.rs](src-tauri/src/ai/json.rs) | Extracts/validates JSON from model output |
| [agent_prompt.rs](src-tauri/src/ai/agent_prompt.rs) | Martha's persona / system prompt |
| [prompts.rs](src-tauri/src/ai/prompts.rs) | Prompt templates |

#### `src-tauri/src/commands/` — Tauri commands (called from the frontend)

| File | Purpose |
| --- | --- |
| `mod.rs` | Module exports |
| [agent.rs](src-tauri/src/commands/agent.rs) | Student tutor chat (`ai_agent_chat`) + conversation summaries |
| [ai.rs](src-tauri/src/commands/ai.rs) | Lesson / quiz generation |
| [classroom.rs](src-tauri/src/commands/classroom.rs) | Classroom flow (plan/teach/evaluate/bake/get lessons) |
| [curriculum.rs](src-tauri/src/commands/curriculum.rs) | Teacher Copilot — lesson planning, term plans, topic suggestions |
| [knowledge.rs](src-tauri/src/commands/knowledge.rs) | Curriculum-doc ingestion, list/delete, stats, export/import **packs** |
| [auth.rs](src-tauri/src/commands/auth.rs) | Login / signup |
| [database.rs](src-tauri/src/commands/database.rs) | Generic DB operations |
| [tts.rs](src-tauri/src/commands/tts.rs) | Offline speech — `speak_text` (Piper / spd-say), `stop_speaking` |

#### `src-tauri/src/db/` — database

| File | Purpose |
| --- | --- |
| [connection.rs](src-tauri/src/db/connection.rs) | **Schema** — every `CREATE TABLE` / FTS5 index. Where the curriculum data model gets added. |
| [seed.rs](src-tauri/src/db/seed.rs) | Seed data on first run |
| `mod.rs` | Module exports |

#### `src-tauri/src/models/` — data structures

One file per domain: `agent`, `ai_lesson`, `curriculum`, `quiz`, `student`,
`subject`, `user`, `video` (`mod.rs` re-exports them).

---

## The AI / curriculum folders (the monorepo)

Each has its own README with full details:

| Folder | Purpose | README |
| --- | --- | --- |
| [curriculum/](curriculum/) | `nigerian.json` / `british.json` / `american.json` — levels, subjects, standards; `validate.py` | [curriculum/README.md](curriculum/README.md) |
| [dataset/](dataset/) | Training examples by subject/level; `REVIEW_CHECKLIST.md` for reviewers | [dataset/README.md](dataset/README.md) |
| [training/](training/) | `merge_dataset.py`, `train.py`, `merge_lora.py`, `convert_to_gguf.py` | [training/README.md](training/README.md) |
| [rag/](rag/) | `ingest.py` (build index), `query.py` (verify retrieval), `docs.sample/` | [rag/README.md](rag/README.md) |

---

## "Where do I look to…" (quick index)

| I want to… | Go to |
| --- | --- |
| See which screens are live | [src/App.tsx](src/App.tsx) |
| Add a backend feature the UI can call | add a command in `src-tauri/src/commands/`, register it in [lib.rs](src-tauri/src/lib.rs), add a binding in [commands.ts](src/lib/tauri/commands.ts) |
| Change the DB schema / add tables | [connection.rs](src-tauri/src/db/connection.rs) |
| Change how Martha answers / which model runs | `src-tauri/src/ai/` (`provider.rs`, `ollama.rs`, `martha.rs`) |
| Work on curriculum retrieval (RAG) | [rag.rs](src-tauri/src/ai/rag.rs) + [rag/](rag/) tools |
| Add/edit a curriculum's structure | [curriculum/](curriculum/) `*.json` |
| Write training data | [dataset/](dataset/) |
| Build/run the desktop app | `npm run tauri:dev` (see [README.md](README.md)) |
| Understand the build plan / next steps | [MVP_PLAN.md](MVP_PLAN.md), [HANDOFF.md](HANDOFF.md) |

> Note: some `src/pages/*` files are legacy and not wired into the router — always
> confirm against [src/App.tsx](src/App.tsx) before extending a page.
