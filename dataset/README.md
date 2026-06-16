# `dataset/` — SkoolBox Training Data

> 🟢 **Subject experts & teachers work here.** No AI knowledge required — just
> subject knowledge and an understanding of how Nigerian students learn.

This folder holds every training example used to fine-tune the SkoolBox AI tutor
(Martha) on the Nigerian curriculum. The quality of SkoolBox's teaching depends
entirely on the quality of the examples written here.

## Folder structure

```
dataset/
├── mathematics/
│   ├── primary1/ … primary6/      (Basic 1–6)
│   ├── jss1/ jss2/ jss3/
│   └── ss1/ ss2/ ss3/
├── english/
├── physics/
├── biology/
├── chemistry/
├── economics/
└── README.md   ← you are here
```

Create class-level subfolders inside each subject as you need them.

## File naming convention

```
dataset/<subject>/<level>/<topic>.jsonl
```

Example: `dataset/mathematics/jss2/linear_equations.jsonl`

See [`mathematics/jss2/linear_equations.jsonl`](mathematics/jss2/linear_equations.jsonl)
for a complete, ready-to-copy example file.

## What a training example looks like

Each example is one student↔SkoolBox conversation with three parts: a **system**
prompt (who the AI is + the class level), a **user** message (the student's
question), and the **assistant** message (the ideal curriculum-aligned answer).

> ⚠️ **Each example must be a single line** in the `.jsonl` file. One JSON object
> per line, no blank lines. Validate with https://jsonlint.com before pushing.

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

**Primary (Basic 1 – Basic 6):**

```
You are SkoolBox, a kind and patient AI tutor for Primary [X] students in
Nigeria. You follow the NERDC [Subject] curriculum for Basic [X]. Use very
simple words, short sentences, and relatable examples. Always encourage the
student.
```

**Junior Secondary (JSS 1 – JSS 3):**

```
You are SkoolBox, a friendly AI tutor for JSS[X] students in Nigeria. You follow
the NERDC [Subject] curriculum and WAEC Junior BECE syllabus. Use clear
explanations with step-by-step working. Reference everyday Nigerian contexts
where possible.
```

**Senior Secondary (SS 1 – SS 3):**

```
You are SkoolBox, an AI tutor for SS[X] students in Nigeria preparing for WAEC
and NECO examinations. You follow the approved Senior Secondary [Subject]
curriculum. Provide detailed explanations aligned to past WAEC question styles.
Challenge students to think critically.
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
