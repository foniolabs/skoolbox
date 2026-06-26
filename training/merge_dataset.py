#!/usr/bin/env python3
"""Merge every .jsonl file under dataset/ into a single training file.

Walks all subfolders of the dataset directory, validates each line is well-formed
JSON in the {"messages": [...]} chat format, and writes the combined output.

Beyond hard errors (which are always skipped), it also runs soft quality checks
that flag likely-weak examples (no class level in the system prompt, very short
answers, duplicates, …). Warnings don't block by default; pass --strict to treat
them as errors (useful in CI / PR review).

Usage:
    python training/merge_dataset.py --input dataset/ --output training/skoolbox_train.jsonl
    python training/merge_dataset.py --input dataset/ --strict        # fail on warnings
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Matches a class level named in the system prompt, e.g. "Primary 4", "JSS2",
# "SS 1", "Basic 5", "Junior/Senior Secondary". Word-boundaried so it does not
# match the "ss" inside words like "assistant".
LEVEL_RE = re.compile(r"\b(primary|basic|junior|senior|jss\s*[1-3]|ss\s*[1-3])\b",
                      re.IGNORECASE)
MIN_ASSISTANT_CHARS = 40


def iter_jsonl_files(root: Path):
    yield from sorted(root.rglob("*.jsonl"))


def validate_example(obj: dict) -> str | None:
    """Return an error string if the example is structurally invalid, else None."""
    if "messages" not in obj or not isinstance(obj["messages"], list):
        return "missing 'messages' list"
    roles = [m.get("role") for m in obj["messages"]]
    if "user" not in roles or "assistant" not in roles:
        return "needs at least one 'user' and one 'assistant' message"
    for m in obj["messages"]:
        if not isinstance(m.get("content"), str) or not m["content"].strip():
            return f"empty content for role '{m.get('role')}'"
    return None


def quality_warnings(obj: dict) -> list[str]:
    """Return non-fatal quality warnings for a structurally valid example."""
    warns: list[str] = []
    msgs = obj["messages"]
    system = next((m["content"] for m in msgs if m.get("role") == "system"), "")
    if not system:
        warns.append("no system prompt (should name Martha + the class level)")
    else:
        low = system.lower()
        if "martha" not in low:
            warns.append("system prompt should name the tutor 'Martha'")
        if not LEVEL_RE.search(system):
            warns.append("system prompt should state the class level (e.g. JSS2, SS1, Primary 4)")
    for m in msgs:
        if m.get("role") == "assistant" and len(m["content"].strip()) < MIN_ASSISTANT_CHARS:
            warns.append(f"assistant answer looks too short (< {MIN_ASSISTANT_CHARS} chars)")
    return warns


def first_user_text(obj: dict) -> str:
    return next((m["content"].strip().lower()
                 for m in obj["messages"] if m.get("role") == "user"), "")


def main() -> int:
    ap = argparse.ArgumentParser(description="Merge + lint dataset .jsonl files.")
    ap.add_argument("--input", default="dataset/", help="Dataset root folder")
    ap.add_argument("--output", default="training/skoolbox_train.jsonl",
                    help="Combined output file ('-' or empty to lint only)")
    ap.add_argument("--strict", action="store_true",
                    help="Treat quality warnings as errors (for CI / PR review)")
    args = ap.parse_args()

    root = Path(args.input)
    if not root.is_dir():
        print(f"error: input folder not found: {root}", file=sys.stderr)
        return 1

    lint_only = args.output in ("", "-")
    out = None
    if not lint_only:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out = out_path.open("w", encoding="utf-8")

    total, kept, errors, warned = 0, 0, 0, 0
    seen_questions: dict[str, str] = {}  # user question -> first location

    try:
        for path in iter_jsonl_files(root):
            for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                line = line.strip()
                if not line:
                    continue
                total += 1
                loc = f"{path}:{lineno}"
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError as e:
                    print(f"  ✗ {loc} invalid JSON: {e}", file=sys.stderr)
                    errors += 1
                    continue
                problem = validate_example(obj)
                if problem:
                    print(f"  ✗ {loc} {problem}", file=sys.stderr)
                    errors += 1
                    continue

                warns = quality_warnings(obj)
                q = first_user_text(obj)
                if q and q in seen_questions:
                    warns.append(f"duplicate question (also at {seen_questions[q]})")
                elif q:
                    seen_questions[q] = loc
                if warns:
                    warned += 1
                    for w in warns:
                        print(f"  ⚠ {loc} {w}", file=sys.stderr)
                    if args.strict:
                        errors += 1
                        continue

                if out:
                    out.write(json.dumps(obj, ensure_ascii=False) + "\n")
                kept += 1
    finally:
        if out:
            out.close()

    dest = "(lint only)" if lint_only else args.output
    print(f"\n{'Checked' if lint_only else 'Merged'} {kept} examples {dest} "
          f"({errors} skipped, {warned} with warnings, {total} seen).")
    if not lint_only:
        if kept < 1000:
            print("⚠️  Fewer than 1,000 examples — training results will be weak.")
        elif kept < 5000:
            print("ℹ️  Aim for ≥ 5,000 examples before a serious training run.")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
