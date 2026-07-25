# Curriculum Reviewer Checklist

> For the **curriculum reviewer** approving a subject expert's pull request before
> it is merged. The goal is to keep training data accurate and curriculum-aligned
> — the model is only as good as what we feed it. See
> [README.md](README.md) for the writing rules.

## Before you start

Run the automated lint on the whole dataset (or the changed files). It catches
the mechanical problems so you can focus on accuracy:

```bash
python training/merge_dataset.py --input dataset/ --output - --strict
```

`--strict` exits non-zero if anything fails, so it doubles as a CI gate. It flags:
JSON errors, missing user/assistant turns, empty content, a missing/!Martha
system prompt, a missing class level, answers that are too short, and duplicate
questions. **Lint passing is necessary but not sufficient** — the checks below
still need a human.

## Per-example review

- [ ] **Curriculum-aligned** — the topic is on the NERDC / WAEC / NECO syllabus
      for that subject and class level (no off-curriculum content).
- [ ] **Factually correct** — the answer is right, including every step of any
      working; calculations check out; definitions are accurate.
- [ ] **Right class level** — the system prompt names the correct level, and the
      language/depth matches it (simple for Primary, exam-rigorous for SS).
- [ ] **Tutor is Martha** — system prompt begins "You are Martha, the SkoolBox
      AI tutor for …".
- [ ] **Shows working** — solve-type answers walk through the steps, not just the
      final result.
- [ ] **Nigerian context** — uses naira, local places/names, real-life examples
      where natural (not forced).
- [ ] **Good teacher voice** — warm and clear, not robotic; no slang errors.
- [ ] **Safe & appropriate** — nothing biased, harmful, or off-topic.

## Per-file review

- [ ] **Correct location** — `dataset/<subject>/<level>/<topic>.jsonl` matches
      the actual subject and level of the content.
- [ ] **Variety** — the file mixes question types (definition, solve-this,
      explain-why, real-life), not 10 of the same shape.
- [ ] **No near-duplicates** — questions aren't trivial rewordings of each other.
- [ ] **One example per line** — valid JSONL (the lint confirms this).

## Decision

- ✅ **Approve & merge** if lint passes and the content is accurate and aligned.
- 💬 **Request changes** with specific line references for anything inaccurate or
      off-curriculum — it's cheaper to fix data now than to retrain later.

> ⚠️ Wrong facts in training data teach the model wrong answers. When unsure
> about a fact, verify against an official NERDC/WAEC text before approving.

---

# The sign-off workflow

Reviewing 400+ examples by opening raw `.jsonl` files is painful, and a verbal
"looks good" leaves no record of *what* was approved. So sign-off runs through
`training/review.py` (stdlib only — no install needed) and is recorded in
`dataset/reviews.json`.

## 1. Build a review packet

```bash
python training/review.py packet                      # everything
python training/review.py packet -s jss1              # just JSS1
python training/review.py packet --pending-only       # skip already-approved files
```

This writes `training/review_packet.html` — a clean, readable page grouped by
file, with every example numbered by its exact `file:line` reference and a row
of tick-boxes. Open it in a browser, or print to PDF for a reviewer who prefers
paper (page breaks are handled). No example is ever split across pages.

## 2. Review against the checklist above

Work through the packet. For anything wrong, note its reference — e.g.
`dataset/nigerian/mathematics/jss/jss2/statistics.jsonl:4` — so the fix is
unambiguous.

## 3. Record the decision, one file at a time

```bash
# approved
python training/review.py sign dataset/nigerian/mathematics/jss/jss1/fractions.jsonl \
  --reviewer "Mrs Adeyemi" --status approved

# needs work (notes are what the writer acts on)
python training/review.py sign dataset/nigerian/english/jss/jss1/tenses.jsonl \
  --reviewer "Mrs Adeyemi" --status changes_requested \
  --notes "line 3: add more irregular verbs; line 6: 'shall' usage is dated"
```

Each entry records the reviewer, the date, the example count, any notes, **and a
SHA-256 of the file's exact content**.

## 4. Check progress at any time

```bash
python training/review.py status              # full picture
python training/review.py status -s jss2      # one level
python training/review.py status --strict     # exit 1 unless everything is approved
```

Files land in four buckets:

| State | Meaning |
| --- | --- |
| **PENDING** | never reviewed |
| **CHANGES REQUESTED** | reviewer found problems — see the notes |
| **STALE** | was approved, but the file has been edited since |
| **APPROVED** | reviewed, and unchanged since |

**Why the hash matters:** if someone edits a file after it was approved — even
one character — it automatically returns to **STALE** and must be reviewed
again. Sign-off can never silently drift away from the content it covered.

## 5. The gate before training

`--strict` is the pre-training gate. Run it before any LoRA run and, once the
dataset stabilises, wire it into CI next to the lint:

```bash
python training/merge_dataset.py --input dataset/ --output - --strict   # mechanical
python training/review.py status --strict                               # human
```

> 📌 **Current reality:** the Primary 4, JSS1 and JSS2 waves were **AI-drafted**
> to accelerate coverage. They pass lint, but *none* of them has human sign-off
> yet — `review.py status` will show them all as PENDING. Getting a qualified
> Nigerian teacher through that backlog is the gate standing between today's
> dataset and a defensible training run.
