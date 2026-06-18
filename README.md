<div align="center">

# SkoolBox

**Offline-first AI tutor for Nigerian secondary schools.**

Built with Tauri · React · TypeScript · SQLite · Claude · Azure TTS

[Features](#features) · [Quick Start](#quick-start) · [Development](#development) · [Project Structure](#project-structure) · [Contributing](#contributing)

</div>

---

## About

SkoolBox is a desktop learning platform designed for classrooms with unreliable internet. It packages an AI teaching assistant, a structured curriculum, lesson planning tools, presentation modes, and adaptive assessment into a single native app that runs on Windows, macOS, and Linux — without needing a constant connection.

The app serves two roles in one binary:

- **Teachers** — plan lessons, present in class, build quizzes, monitor student progress.
- **Students** — explore subjects, learn with an embedded AI tutor, take quizzes, track progress.

Full product context lives in [PRD.md](PRD.md).

---

## Features

### For Teachers
- Dashboard with class progress, recent assessments, and today's lessons
- AI-assisted **Lesson Planner**
- Full-screen **Presentation** mode (whiteboard, slideshow, narrated) with KaTeX equations and TTS
- **Quiz Builder** + auto-grading
- **Curriculum Planner** with term-by-term coverage tracking
- Per-class and per-student **monitoring** dashboards
- Student **enrollment** (individual + bulk)

### For Students
- Personalised home with recommended topics
- Subject and topic browser with progress indicators
- Embedded **AI tutor** (chat + voice narration)
- Quizzes with instant feedback and review
- Personal progress charts

### Platform
- Runs **offline** for all core flows
- Local-only data store (SQLite via Tauri)
- Anthropic Claude integration (when online)
- Azure Speech Services TTS with browser-native fallback
- `.docx` import for existing lesson materials

---

## Tech Stack

| Layer | Tech |
|---|---|
| Desktop shell | [Tauri 2](https://tauri.app/) (Rust) |
| Frontend | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Routing | [React Router v6](https://reactrouter.com/) |
| Charts | [Recharts](https://recharts.org/) |
| Math | [KaTeX](https://katex.org/) |
| Animation | [Framer Motion](https://www.framer.com/motion/) |
| Local DB | SQLite via `tauri-plugin-sql` |
| AI | [Anthropic Claude](https://www.anthropic.com/) |
| TTS | Azure Speech Services + Web Speech API |

---

## Quick Start

### Prerequisites

You need all of these installed before you start:

| Tool | Minimum version | Install |
|---|---|---|
| **Node.js** | 18+ | https://nodejs.org/ (or via `nvm`) |
| **npm** | 9+ | ships with Node |
| **Rust** | 1.77.2+ | https://rustup.rs/ |
| **Tauri system deps** | — | See https://tauri.app/start/prerequisites/ |

> **Tauri system dependencies** vary by OS — make sure you follow the official Tauri prerequisites page for your platform (e.g., `webkit2gtk` on Linux, Xcode CLI on macOS, MSVC + WebView2 on Windows). Skipping this is the #1 cause of build failures.

### 1. Clone the repo

```bash
git clone https://github.com/foniolabs/skoolbox.git
cd skoolbox
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file in the project root (see [`.env.example`](.env.example)):

```env
# Anthropic API key — required only for the online AI tutor features.
# Get one at https://console.anthropic.com/
API_KEY=sk-ant-...

# Optional: Azure Speech Services for high-quality TTS.
# Without these, the app falls back to the browser's built-in voices.
AZURE_TTS_KEY=
AZURE_TTS_REGION=
```

> **Never commit `.env`.** It is gitignored. Share keys with teammates over a secure channel (1Password, Bitwarden, etc.).

### 4. Run in dev mode

For the **desktop app** (recommended — this is the primary target):

```bash
npm run tauri:dev
```

For the **frontend only** (web preview, faster iteration on UI):

```bash
npm run dev
```

The web preview runs at http://localhost:5173.

### 5. Build for production

```bash
# Production desktop bundles (.dmg / .msi / .deb / .AppImage)
npm run tauri:build

# Web build only (outputs to dist/)
npm run build
```

Built installers land in `src-tauri/target/release/bundle/`.

---

## Development

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (frontend only) |
| `npm run tauri:dev` | Launches the full desktop app in dev mode with HMR |
| `npm run build` | Type-checks then builds the frontend |
| `npm run tauri:build` | Builds production desktop installers |
| `npm run preview` | Serves the production frontend build |
| `npm run lint` | Runs ESLint across the project |

### Code style

- **TypeScript everywhere** in the frontend — no untyped `any` unless unavoidable.
- **Tailwind first** — prefer utility classes; only drop into custom CSS for non-trivial cases.
- **Zustand stores** live under [`src/stores/`](src/stores/) — one store per concern.
- **Pages** under [`src/pages/`](src/pages/) compose **components** from [`src/components/`](src/components/).
- Lint before you push: `npm run lint`.

### Working on the Rust side

The Tauri shell lives in [`src-tauri/`](src-tauri/). After changing Rust code:

```bash
npm run tauri:dev   # rebuilds the native shell automatically
```

---

## Project Structure

SkoolBox is a **monorepo**: the Tauri app lives at the repo root, and the AI
fine-tuning pipeline lives alongside it in `dataset/`, `training/`, and `rag/`.
See [MONOREPO.md](MONOREPO.md) for the full layout and
[COLLABORATION.md](COLLABORATION.md) for what's shared via git vs regenerated.

```
skoolbox/
├── PRD.md                  # Product requirements
├── README.md               # You are here
├── MONOREPO.md             # Monorepo layout + who-works-where
├── COLLABORATION.md        # Tracked vs ignored, team workflow
├── index.html              # Vite entry
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig*.json
├── eslint.config.js
├── public/                 # Static assets served at root
├── src/                    # React frontend
│   ├── App.tsx             # Role-based router
│   ├── main.tsx            # Entry point
│   ├── index.css
│   ├── assets/
│   ├── components/         # Reusable UI by feature area
│   │   ├── ai-learn/
│   │   ├── ai-tutor/
│   │   ├── auth/
│   │   ├── curriculum/
│   │   ├── dashboard/
│   │   ├── layout/
│   │   ├── progress/
│   │   ├── quizzes/
│   │   ├── settings/
│   │   ├── shared/
│   │   ├── subjects/
│   │   ├── teach/
│   │   └── topic-learning/
│   ├── data/               # Static seed content (subjects, questions, …)
│   ├── lib/                # Cross-cutting helpers
│   │   ├── ai/             # Claude teaching assistant
│   │   ├── db/             # SQLite helpers
│   │   ├── quiz/
│   │   ├── tauri/
│   │   └── tts/            # Azure + browser TTS
│   ├── pages/              # Route-level components (teacher + student/)
│   └── stores/             # Zustand state stores
├── src-tauri/              # Rust shell + native APIs
│   ├── Cargo.toml
│   ├── tauri.conf.json     # App config (name, CSP, windows, bundle)
│   ├── capabilities/
│   ├── icons/
│   ├── ai/                 # Ollama Modelfile + bundled model assets
│   └── src/                # Rust backend (AI engine, RAG, DB, commands)
│
│   ── AI fine-tuning pipeline (the monorepo) ──
├── dataset/                # 🟢 Subject experts write .jsonl training examples
│   ├── README.md           #    System-prompt templates + writing rules
│   └── <subject>/<level>/<topic>.jsonl
├── training/               # 🔵 LoRA pipeline for Qwen3 4B
│   ├── merge_dataset.py    #    Combine + validate all dataset/*.jsonl
│   ├── train.py            #    LoRA fine-tune with Unsloth
│   ├── merge_lora.py       #    Merge adapters into base model
│   ├── convert_to_gguf.py  #    Quantize to Q4_K_M GGUF
│   ├── requirements.txt
│   └── README.md
└── rag/                    # 🔵 Curriculum retrieval index builder
    ├── ingest.py           #    Chunk docs into the SQLite FTS5 index
    └── README.md
```

---

## Contributing

This is a **private repository** owned by [Foniolabs](https://github.com/foniolabs). External contributions are not currently open. If you're a member of the team, follow the workflow below.

### Getting added to the team

The repository admin adds collaborators via **GitHub → Settings → Collaborators and teams**. If you can't see the repo, ping the admin with the email tied to your GitHub account.

### Branching

- `main` is **always deployable**. Never push directly.
- Create a feature branch off `main`:

  ```bash
  git checkout main
  git pull
  git checkout -b feat/<short-description>
  ```

- Branch name conventions:
  - `feat/...` — new feature
  - `fix/...` — bug fix
  - `chore/...` — tooling, deps, refactor with no behaviour change
  - `docs/...` — documentation only

### Commits

We follow **Conventional Commits**:

```
feat(quiz): add per-topic auto-grading
fix(tts): fall back to browser voices when Azure key missing
chore(deps): bump tauri to 2.10.3
docs(readme): clarify Tauri prereqs on Linux
```

- Keep commits focused — one logical change per commit.
- Write the message in the imperative ("add", not "added").
- Reference issues in the body where applicable (`Closes #42`).

### Pull requests

1. Push your branch: `git push -u origin feat/your-branch`
2. Open a PR against `main` on GitHub.
3. Fill in the PR template (what + why + how tested).
4. Request at least **one reviewer** from the team.
5. CI must pass (lint + build).
6. Squash-merge once approved; delete the branch.

### Local checks before pushing

```bash
npm run lint
npm run build         # type-check + frontend build
npm run tauri:dev     # smoke-test the desktop app
```

### Reporting bugs

Open a GitHub issue with:
- What you did
- What you expected
- What actually happened
- OS + version, app version, and (if relevant) screenshots or logs

---

## Security

- **Never commit `.env` or any API keys.** `.env` is gitignored.
- If you discover a security issue, **do not open a public issue**. Email the maintainers directly.

---

## License

Proprietary — © Foniolabs. All rights reserved.

The Rust shell (`src-tauri/`) declares `MIT` in `Cargo.toml` as a placeholder; the project as a whole is currently closed-source.

---

## Maintainers

- **Foniolabs** — https://github.com/foniolabs

For access requests, ping the admin on your team channel.
