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
