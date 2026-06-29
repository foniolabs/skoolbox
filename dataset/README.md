# `dataset/` — SkoolBox Training Data

> 🟢 **Subject experts & teachers work here.** No AI knowledge required — just
> subject knowledge and an understanding of how Nigerian students learn.

This folder holds every training example used to fine-tune the SkoolBox AI tutor
(Martha) on the Nigerian curriculum. The quality of SkoolBox's teaching depends
entirely on the quality of the examples written here.

> 📚 **Adding a whole textbook or past-questions paper?** That's a different (and
> often faster) path — see [HOW_TO_ADD_A_TEXTBOOK.md](HOW_TO_ADD_A_TEXTBOOK.md).
> This README is for writing Q&A examples by hand.

## Folder structure

Content is organised **curriculum → subject → phase → class** (see
[`../docs/CURRICULUM_ARCHITECTURE.md`](../docs/CURRICULUM_ARCHITECTURE.md)):

```
dataset/
└── nigerian/                       ← curriculum
    └── mathematics/                ← subject
        ├── primary/                ← phase: primary | jss | ss
        │   └── primary1/ … primary6/
        ├── jss/
        │   └── jss1/ jss2/ jss3/
        └── ss/
            └── ss1/ ss2/ ss3/
    └── english/ physics/ biology/ chemistry/ economics/
```

Each **class folder** holds a required `metadata.json` plus your `.jsonl` files:

```
dataset/nigerian/mathematics/jss/jss2/
├── metadata.json            ← the "contract" (see below); required
├── linear_equations.jsonl   ← your new file goes here
└── ...
```

## File naming convention

```
dataset/nigerian/<subject>/<phase>/<class>/<topic>.jsonl
```

Example: `dataset/nigerian/mathematics/jss/jss2/linear_equations.jsonl`

Exam classes (Primary 5/6, JSS3, SS3) also hold past-question banks named
`<exam_body>_past_questions.jsonl` (e.g. `waec_bece_past_questions.jsonl`).

See [`nigerian/mathematics/jss/jss2/linear_equations.jsonl`](nigerian/mathematics/jss/jss2/linear_equations.jsonl)
for a complete, ready-to-copy example file.

## The `metadata.json` contract

Every class folder needs exactly one `metadata.json` — it tells the retrieval
layer the curriculum, class level, age range, exam status, prerequisites, and
topics for that folder. **Without it, ingest skips the folder.**

You don't hand-write these. After adding a new class folder or topic, run from
the repo root:

```bash
python rag/scaffold_metadata.py            # create/refresh every metadata.json
python rag/scaffold_metadata.py --check    # CI guard: fail if any is missing/stale
```

It preserves the `topics` and `textbooks` lists (edit those by hand to record the
real textbook names and topics) and keeps the structural fields consistent.

## What a training example looks like

Each example is one student↔SkoolBox conversation with three parts: a **system**
prompt (who the AI is + the class level), a **user** message (the student's
question), and the **assistant** message (the ideal curriculum-aligned answer).

> ⚠️ **Each example must be a single line** in the `.jsonl` file. One JSON object
> per line, no blank lines. Validate with https://jsonlint.com before pushing.

**Check your work before pushing.** From the repo root, run the linter — it flags
JSON errors, a missing/wrong system prompt, missing class level, answers that are
too short, and duplicate questions:

```bash
python training/merge_dataset.py --input dataset/ --output - --strict
```

Curriculum reviewers approving a PR follow [REVIEW_CHECKLIST.md](REVIEW_CHECKLIST.md).

## Rules for good examples

| Rule | Why |
| --- | --- |
| Always state the class level in the system prompt | The AI must know if it's teaching Primary 4 or SS3 |
| Use Nigerian context | naira, Lagos, Abuja, names like Emeka, Amina, Chidi |
| Show working step by step | Students learn by seeing how an answer is reached |
| Write how a good teacher speaks | Avoid robotic, overly formal language |
| Align to WAEC / NECO / NERDC | Only approved curriculum topics |
| Aim for ≥ 200 examples per subject per class level | More good data = better tutor |
| Vary question types | Definitions, solve-this, explain-why, real-life uses |

## System prompt templates

> **The tutor's name is Martha** (Martha is the SkoolBox AI tutor). Always begin
> the system prompt with "You are Martha, the SkoolBox AI tutor …".

**Primary (Basic 1 – Basic 6):**

```
You are Martha, the SkoolBox AI tutor for Primary [X] students in Nigeria. You
follow the NERDC [Subject] curriculum for Basic [X]. Use very simple words,
short sentences, and relatable examples. Always encourage the student.
```

**Junior Secondary (JSS 1 – JSS 3):**

```
You are Martha, the SkoolBox AI tutor for JSS[X] students in Nigeria. You follow
the NERDC [Subject] curriculum and WAEC Junior BECE syllabus. Use clear
explanations with step-by-step working. Reference everyday Nigerian contexts
where possible.
```

**Senior Secondary (SS 1 – SS 3):**

```
You are Martha, the SkoolBox AI tutor for SS[X] students in Nigeria preparing
for WAEC and NECO examinations. You follow the approved Senior Secondary
[Subject] curriculum. Provide detailed explanations aligned to past WAEC
question styles. Challenge students to think critically.
```

## Daily workflow

```bash
git pull                              # get teammates' latest work
# ... write/edit your .jsonl files ...
git add .
git commit -m "Add JSS2 algebra examples"
git push
```

Once approved, the ML developer combines every `.jsonl` here into one training
file — see [`../training/README.md`](../training/README.md).
