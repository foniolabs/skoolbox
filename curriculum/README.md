# `curriculum/` — Curriculum Frameworks

> 🔵 Developers + 🟢 curriculum experts. The structural backbone of SkoolBox's
> multi-curriculum support. See [../MVP_PLAN.md](../MVP_PLAN.md) for the bigger picture.

SkoolBox is a **classroom co-pilot** that works within a *chosen* curriculum. This
folder defines the three supported curricula as structured data, so the app never
hardcodes one country's levels or subjects.

```
curriculum/
├── nigerian.json     NERDC / WAEC / NECO — Primary 1-6, JSS 1-3, SS 1-3
├── british.json      UK National Curriculum — Reception, Years 1-13, Key Stages
├── american.json     Common Core / NGSS — Kindergarten, Grades 1-12
├── validate.py
└── README.md
```

## What a framework file contains

Each `<key>.json` describes one curriculum:

- **`key`** — `nigerian` | `british` | `american` (matches the filename).
- **`name`**, **`authority`**, **`description`** — display + provenance.
- **`levels`** — the class/year ladder: `{ key, name, stage, order }`. `stage`
  groups levels (e.g. "Key Stage 2", "Senior Secondary", "Middle School"); `order`
  sorts the whole ladder.
- **`subjects`** — `{ key, name }`. Subject naming differs across curricula
  ("English Studies" vs "English" vs "English Language Arts").
- **`standards`** — *representative* learning standards: `{ code, subject, level,
  title, description }`, each referencing a subject + level key.

## How the app uses these

On first run the Tauri app seeds its curriculum tables — `curricula`,
`curriculum_levels`, `curriculum_subjects`, `curriculum_standards` (see
[../MVP_PLAN.md](../MVP_PLAN.md) §3) — from these files. The school then selects
its **active curriculum** (per installation), and every co-pilot feature (lesson
note, lesson plan, textbook) reads its subjects/levels/standards from the active
curriculum and grounds output in curriculum documents ingested via
[../rag/](../rag/).

## Standards are representative, not exhaustive

Each file ships a handful of standards to establish the structure and seed the
demo. The **full** body of standards for a subject/level is added by ingesting
official curriculum documents through the RAG pipeline ([../rag/README.md](../rag/README.md)),
not by hand-encoding every standard here.

## Validate before committing

```bash
python curriculum/validate.py
```

Checks JSON validity, required fields, unique level keys/orders, unique subject
keys, and that every standard points to an existing subject + level.

## Adding or extending a curriculum

1. Edit the relevant `<key>.json` (or add a new one named after its `key`).
2. Keep `order` contiguous and `stage` consistent.
3. Run `python curriculum/validate.py` until clean.
4. The app re-seeds from these files (additively) — no code change needed to add
   levels, subjects, or standards.
