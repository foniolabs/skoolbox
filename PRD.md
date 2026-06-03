# SkoolBox — Product Requirements Document

| | |
|---|---|
| **Product** | SkoolBox AI Tutor |
| **Owner** | Foniolabs |
| **Status** | Draft — v0.1 (MVP in development) |
| **Last updated** | 2026-06-03 |
| **Repository** | https://github.com/foniolabs/skoolbox |
| **Platform** | Desktop (Tauri) — Windows, macOS, Linux |

---

## 1. Overview

SkoolBox is an **offline-first, AI-powered teaching and learning platform** built for secondary and upper-primary schools in underserved Nigerian communities. It ships as a native desktop application (via Tauri) so that schools with intermittent or no internet can still benefit from AI-assisted teaching, structured curricula, and adaptive assessment.

The product serves two primary user roles in a single application:

- **Teachers** — plan lessons, present interactive content in the classroom, assess students with quizzes, and monitor progress.
- **Students** — explore subjects, learn topics with an embedded AI tutor, take quizzes, and track their own progress.

---

## 2. Problem Statement

Nigerian secondary schools, particularly outside major urban centres, face three compounding challenges:

1. **Connectivity gap** — most cloud-based EdTech tools assume reliable broadband, which excludes the schools that need them most.
2. **Teacher load** — a single teacher commonly handles 40+ students across multiple class levels, leaving no realistic time to differentiate instruction or prepare rich lesson materials.
3. **Curriculum drift** — without structured planning tools, lesson coverage varies widely between schools and between terms, leaving gaps in foundational knowledge.

SkoolBox addresses all three: it runs locally, automates lesson preparation and assessment, and grounds everything in a structured Nigerian-curriculum-aligned topic tree.

---

## 3. Goals & Non-Goals

### Goals

- **G1** — Deliver a fully functional desktop app that works **without internet** for the core learning and assessment loop.
- **G2** — Reduce teacher lesson-preparation time by ≥ 60% through AI-assisted lesson planning and ready-made presentations.
- **G3** — Give students a one-to-one AI tutor experience for every topic in the curriculum.
- **G4** — Provide teachers with a real-time view of class and per-student progress.
- **G5** — Cover Primary 5 through JSS3 across core subjects (Mathematics, English, Basic Science, Social Studies) at MVP.

### Non-Goals (MVP)

- Mobile (Android/iOS) clients.
- Cross-school data sync or central reporting dashboard.
- Payment / billing / school-admin tenancy.
- Generative content for teachers to publish outside the app.
- Live video conferencing or remote classrooms.

---

## 4. Target Users & Personas

### 4.1 Mrs. Adebayo — JSS2 Mathematics Teacher
- Teaches 5 classes of 40+ students.
- Has a school-provided laptop; internet at school is unreliable.
- Wants: faster lesson prep, classroom-ready visual content, automated quiz grading.

### 4.2 Tunde — JSS1 Student, age 12
- Shares a family laptop with siblings.
- Falls behind when he misses class; embarrassed to ask the teacher to repeat topics.
- Wants: someone to explain things patiently, at his pace, in language he understands.

### 4.3 Mr. Eze — School Head / Curriculum Coordinator
- Oversees 8 teachers across 3 class levels.
- Wants: assurance that the syllabus is being covered consistently; visibility into which topics are weak across the school.

---

## 5. User Stories

### Teacher

- As a teacher, I can sign in and land on a **dashboard** showing today's lessons, recent quiz performance, and class progress.
- As a teacher, I can use the **Lesson Planner** to generate a structured lesson on any curriculum topic with AI assistance.
- As a teacher, I can **present** a lesson in full-screen mode (whiteboard, slideshow, or narrated modes) directly from the app.
- As a teacher, I can **build or auto-generate quizzes** for a topic and assign them.
- As a teacher, I can **enrol students** into my class manually or in bulk.
- As a teacher, I can view a **Curriculum Planner** broken down by term and track which topics have been covered.
- As a teacher, I can **monitor** class progress, drill into a student, and see strengths and weaknesses.

### Student

- As a student, I can sign in and see my **home dashboard** with subjects and recommended next topics.
- As a student, I can browse **subjects** and pick a topic to learn.
- As a student, I can ask the **AI tutor** questions about the topic in plain English and get spoken + written explanations.
- As a student, I can take **quizzes**, see my score, and review what I got wrong.
- As a student, I can see my own **progress** across subjects and topics over time.

---

## 6. Functional Requirements

### 6.1 Authentication & Roles
- Local account creation (teacher or student) — credentials stored locally with bcrypt.
- Role-based routing: teachers and students land on entirely different layouts and route trees.
- Session persisted across app launches via local store.

### 6.2 Teacher Module

| Feature | Description |
|---|---|
| Dashboard | At-a-glance: today's lessons, recent assessments, class progress widgets. |
| Prepare | Browse subjects → topics → generate lesson content. |
| Lesson Planner | AI-assisted creation of lesson outline, key points, examples, and questions. |
| Teach | Quick-launch into a teaching session for any prepared lesson. |
| Presentation | Full-screen, distraction-free presentation mode with three styles: whiteboard, slideshow, narrated. Supports equations (KaTeX) and TTS narration. |
| Assess | Manage quizzes, launch the QuizPlayer, review results. |
| Monitor | Per-class and per-student progress visualisations (Recharts). |
| Enroll | Add students individually or import a roster. |
| Curriculum Planner | Term-by-term topic plan with coverage tracking. |

### 6.3 Student Module

| Feature | Description |
|---|---|
| Home | Personalised landing page with next recommended topics. |
| Subjects | Subject → topic browser with progress indicators. |
| Topic Learning | Interactive lesson view + embedded AI tutor chat. |
| Quizzes | Browse, take, and review quizzes; results stored locally. |
| Progress | Personal progress charts across subjects/topics. |

### 6.4 AI Teaching Assistant
- Powered by Anthropic's Claude API (Sonnet/Opus class models).
- Accepts a topic + student question; returns structured response: narration, key points, optional equations, optional diagram hints.
- Falls back gracefully when offline: cached lessons and pre-generated content remain fully usable.

### 6.5 Text-to-Speech (TTS)
- Primary: **Azure Speech Services** for high-quality, natural narration.
- Fallback: browser-native `speechSynthesis` API when Azure is unavailable or unconfigured.

### 6.6 Content Import
- Teachers can import `.docx` lesson materials via `mammoth` for parsing into the planner.

### 6.7 Local Persistence
- SQLite via `tauri-plugin-sql` for all durable data (users, classes, enrolments, lessons, quizzes, attempts, progress).
- No data leaves the device unless the user explicitly triggers an AI request (which requires internet and a configured key).

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Offline** | All core flows (browse, learn from cached lesson, take quiz, view progress) must work with no network. |
| **Performance** | App cold-start ≤ 3s on a mid-range laptop (Intel i3 / 8 GB RAM). Page transitions ≤ 200ms. |
| **Footprint** | Installer ≤ 80 MB. RAM usage at idle ≤ 250 MB. |
| **Security** | API keys read from local config, never bundled into the binary. Passwords hashed with bcrypt. CSP restricts script and connection origins. |
| **Accessibility** | Keyboard navigable; minimum WCAG AA contrast for primary surfaces. |
| **Portability** | Single codebase ships to Windows, macOS, and Linux via Tauri bundles. |

---

## 8. Technical Architecture

### 8.1 Stack

| Layer | Technology |
|---|---|
| Shell | Tauri 2 (Rust) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Routing | React Router v6 |
| Animation | Framer Motion |
| Charts | Recharts |
| Math rendering | KaTeX |
| Document parsing | Mammoth (`.docx`) |
| Local DB | SQLite (via `tauri-plugin-sql`, `rusqlite`) |
| AI | Anthropic Claude API |
| TTS | Azure Speech Services (primary), Web Speech API (fallback) |
| Auth | Local accounts, bcrypt hashes |

### 8.2 High-Level Diagram

```
┌─────────────────────────────────────────────────┐
│                  Tauri Shell                    │
│  ┌───────────────────────────────────────────┐  │
│  │  React + TypeScript Frontend              │  │
│  │  ┌─────────────┐    ┌─────────────────┐   │  │
│  │  │ Teacher UI  │    │   Student UI    │   │  │
│  │  └─────────────┘    └─────────────────┘   │  │
│  │  ┌──────────────────────────────────────┐ │  │
│  │  │ Zustand stores (auth, quiz, etc.)    │ │  │
│  │  └──────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Rust core: SQLite • FS • HTTP            │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
              │                          │
              ▼                          ▼
       ┌─────────────┐           ┌─────────────┐
       │  Anthropic  │           │  Azure TTS  │
       │   (online)  │           │   (online)  │
       └─────────────┘           └─────────────┘
```

### 8.3 Data Model (initial)

- `users(id, name, email, password_hash, role)`
- `subjects(id, name, icon)`
- `topics(id, subject_id, name, description, class_levels)`
- `lessons(id, topic_id, author_id, mode, content, created_at)`
- `quizzes(id, topic_id, author_id, questions_json, created_at)`
- `quiz_attempts(id, quiz_id, student_id, score, answers_json, completed_at)`
- `enrollments(id, teacher_id, student_id, class_level, created_at)`
- `progress(id, student_id, topic_id, percent, status, updated_at)`

---

## 9. Curriculum Scope (MVP)

| Subject | Class levels |
|---|---|
| Mathematics | Pry 5 – JSS3 |
| English Language | Pry 5 – JSS3 |
| Basic Science | Pry 5 – JSS3 |
| Social Studies | Pry 5 – JSS3 |

Each subject ships with a baseline topic tree (e.g., Mathematics: Algebra, Linear Equations, Geometry, Statistics, …). Additional subjects (Civic Education, Computer Studies) are planned for v0.2.

---

## 10. Success Metrics

| Metric | Target (6 months post-pilot) |
|---|---|
| Pilot schools | 5 |
| Active teacher accounts | 30 |
| Active student accounts | 600 |
| Median teacher prep time saved per lesson | ≥ 30 min |
| Quizzes taken per student per week | ≥ 3 |
| Topic completion rate per active student | ≥ 1 / week |
| Reported app crashes | < 1% of sessions |

---

## 11. Release Plan

| Version | Focus | Target |
|---|---|---|
| **v0.1 (current)** | MVP: auth, prepare, teach, assess, monitor, student learn + quizzes | Q3 2026 |
| **v0.2** | Curriculum planner v2, .docx import polish, additional subjects | Q4 2026 |
| **v0.3** | Offline AI fallback (on-device small model), bulk roster import, analytics export | Q1 2027 |
| **v1.0** | Pilot rollout in 5 schools, stability + accessibility hardening | Q2 2027 |

---

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| API costs balloon as usage grows | Medium | High | Cache AI responses per topic; rate-limit; explore on-device models for v0.3. |
| Schools lack hardware to run desktop app | Medium | High | Keep footprint tight; publish minimum-spec guide; pilot only with vetted sites. |
| Teachers do not adopt new workflows | Medium | High | Co-design with pilot teachers; in-app onboarding; offer training sessions. |
| Curriculum mismatch between states | High | Medium | Allow per-school topic overrides; track most-edited topics for next release. |
| Data loss on a single device | Medium | High | Local backup/export feature; future cloud-sync opt-in. |

---

## 13. Open Questions

- Do we need a separate **school-admin role** distinct from teacher?
- Should AI tutor responses be **logged locally** for the teacher to review what their students are asking?
- What's the right **content licensing model** for the bundled curriculum?
- Do we support **multi-user accounts on a shared device** (kiosk mode for classrooms)?

---

## 14. Appendix — Glossary

- **JSS** — Junior Secondary School (JSS1–JSS3 in the Nigerian system).
- **Pry** — Primary school class level.
- **Tauri** — Rust-based framework for building lightweight cross-platform desktop apps with a web frontend.
- **TTS** — Text-to-Speech.
- **CSP** — Content Security Policy.
