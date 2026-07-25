#!/usr/bin/env python3
"""Give Martha's answers readable structure — steps on their own lines.

The dataset was written as single dense paragraphs. That hurts twice: reviewers
have to pick working out of a wall of text, and Martha delivers it to students
that way too (the app renders answers with `white-space: pre-wrap`, so line
breaks in the data reach the whiteboard and lesson notes).

This rewrites the *assistant* messages only, adding line breaks around three
structures that are already present in the prose:

    Step 1: … Step 2: …        →  each step on its own line
    First, … Second, … Third,  →  each item on its own line
    NOUN: … VERB: …            →  each labelled definition on its own line

plus a blank line between the opening sentence, the block, and any closing
commentary. Questions and system prompts are untouched, and no wording changes —
this only moves whitespace, so a reviewed file's meaning cannot drift.

JSONL stays one object per line; the newlines live inside the JSON string as
`\\n` escapes, exactly as the format intends.

    python training/reformat_answers.py --dry-run      # preview, writes nothing
    python training/reformat_answers.py                # apply
    python training/reformat_answers.py -s jss2        # limit to matching paths
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = REPO_ROOT / "dataset"

# "Step 1:" … "Step 12:"
STEP = re.compile(r"(?<!^)(?<!\n)\s+(Step \d+:)")
# Sentence-initial ordinals used as a list: "First, … Second, …"
ORDINAL = re.compile(
    r"(?<!^)(?<!\n)\s+((?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Finally)[,:])")
# A sentence that opens a labelled definition: "MELTING: solid to liquid",
# "It SAVES MONEY: fewer units". We break before the whole SENTENCE, never before
# the label itself — splitting mid-sentence ("EVAPORATION or / BOILING:") mangles
# the prose. Sentence ends may carry a closing quote: `crops.'`
SENTENCE_SPLIT = re.compile(r"(?<=[.!?][\'\"\u2019\u201d])\s+|(?<=[.!?])\s+")
CAPS_LABEL = re.compile(r"^.{0,24}?\b[A-Z][A-Z]{2,}(?:\s+[A-Z0-9][A-Z0-9]*)*[:—-]")
# Commentary that typically closes an answer after the working is done.
CLOSER = re.compile(
    r"(?<!\n)\s+((?:So|Check|Correct!|Notice|Remember|Practise|Practice|Tip:|Always|Never|"
    r"A common|The most common|A very common|This is why|That is why)\b)")


def reformat(text: str, refresh: bool = False) -> str:
    """Insert line breaks around structure already present in the prose."""
    if "\n" in text:
        if not refresh:         # already formatted — leave it alone
            return text
        text = re.sub(r"\s*\n\s*", " ", text).strip()   # start from flat prose

    out = text
    steps = len(re.findall(r"Step \d+:", out))
    ordinals = len(ORDINAL.findall(out))
    labels = sum(1 for sent in SENTENCE_SPLIT.split(out) if CAPS_LABEL.match(sent))

    # Only restructure when there is a genuine list (two or more items),
    # otherwise a lone "First," is just prose.
    if steps >= 2:
        out = STEP.sub(r"\n\1", out)
    elif ordinals >= 2:
        out = ORDINAL.sub(r"\n\1", out)
    elif labels >= 2:
        sentences = SENTENCE_SPLIT.split(out)
        rebuilt = []
        for sent in sentences:
            if rebuilt and CAPS_LABEL.match(sent):
                rebuilt.append("\n" + sent)
            elif rebuilt:
                rebuilt.append(" " + sent)
            else:
                rebuilt.append(sent)
        out = "".join(rebuilt)
        if "\n" not in out:
            return text
    else:
        return text

    lines = out.split("\n")
    head, body = lines[0], lines[1:]

    # Closing commentary rides on the end of the last item — split it off so the
    # summary reads as its own paragraph rather than part of the final step.
    if body:
        last = body[-1]
        m = CLOSER.search(last, pos=1)
        if m and m.start() > 30:          # keep short items intact
            body[-1] = last[:m.start()]
            tail = last[m.start():].strip()
            return f"{head}\n\n" + "\n".join(body).strip() + f"\n\n{tail}"

    return f"{head}\n\n" + "\n".join(body).strip()


def process(path: Path, dry_run: bool, samples: list, refresh: bool = False) -> tuple[int, int]:
    changed = total = 0
    out_lines = []
    for raw in path.read_text().splitlines():
        raw = raw.strip()
        if not raw:
            continue
        obj = json.loads(raw)
        total += 1
        for msg in obj.get("messages", []):
            if msg.get("role") != "assistant":
                continue
            before = msg.get("content", "")
            after = reformat(before, refresh)
            if after != before:
                changed += 1
                msg["content"] = after
                if len(samples) < 3:
                    samples.append((path, before, after))
        out_lines.append(json.dumps(obj, ensure_ascii=False))

    if changed and not dry_run:
        path.write_text("\n".join(out_lines) + "\n")
    return changed, total


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="preview without writing")
    ap.add_argument("--refresh", action="store_true",
                    help="re-flow answers that already contain line breaks")
    ap.add_argument("-s", "--scope", help="only files whose path contains this")
    args = ap.parse_args()

    files = sorted(p for p in DATASET_DIR.rglob("*.jsonl"))
    if args.scope:
        files = [p for p in files if args.scope in p.as_posix()]
    if not files:
        sys.exit("No .jsonl files matched.")

    samples: list = []
    total_changed = total_seen = files_touched = 0
    for path in files:
        changed, seen = process(path, args.dry_run, samples, args.refresh)
        total_seen += seen
        total_changed += changed
        if changed:
            files_touched += 1
            print(f"  {changed:3}/{seen:<3} {path.relative_to(REPO_ROOT)}")

    if samples:
        print("\n" + "─" * 72)
        for path, before, after in samples[:2]:
            print(f"\nEXAMPLE — {path.relative_to(REPO_ROOT)}\n")
            print("BEFORE:\n" + before[:420] + ("…" if len(before) > 420 else ""))
            print("\nAFTER:\n" + after[:520] + ("…" if len(after) > 520 else ""))
            print("─" * 72)

    verb = "would reformat" if args.dry_run else "reformatted"
    print(f"\n{verb} {total_changed} of {total_seen} answers across {files_touched} file(s).")
    if args.dry_run:
        print("Nothing written. Re-run without --dry-run to apply.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
