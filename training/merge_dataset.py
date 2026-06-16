#!/usr/bin/env python3
"""Merge every .jsonl file under dataset/ into a single training file.

Walks all subfolders of the dataset directory, validates each line is well-formed
JSON in the {"messages": [...]} chat format, and writes the combined output.

Usage:
    python training/merge_dataset.py --input dataset/ --output training/skoolbox_train.jsonl
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def iter_jsonl_files(root: Path):
    yield from sorted(root.rglob("*.jsonl"))


def validate_example(obj: dict) -> str | None:
    """Return an error string if the example is invalid, else None."""
    if "messages" not in obj or not isinstance(obj["messages"], list):
        return "missing 'messages' list"
    roles = [m.get("role") for m in obj["messages"]]
    if "user" not in roles or "assistant" not in roles:
        return "needs at least one 'user' and one 'assistant' message"
    for m in obj["messages"]:
        if not isinstance(m.get("content"), str) or not m["content"].strip():
            return f"empty content for role '{m.get('role')}'"
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Merge dataset .jsonl files into one.")
    ap.add_argument("--input", default="dataset/", help="Dataset root folder")
    ap.add_argument("--output", default="training/skoolbox_train.jsonl",
                    help="Combined output file")
    args = ap.parse_args()

    root = Path(args.input)
    if not root.is_dir():
        print(f"error: input folder not found: {root}", file=sys.stderr)
        return 1

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    total, kept, errors = 0, 0, 0
    with out_path.open("w", encoding="utf-8") as out:
        for path in iter_jsonl_files(root):
            for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                line = line.strip()
                if not line:
                    continue
                total += 1
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError as e:
                    print(f"  ✗ {path}:{lineno} invalid JSON: {e}", file=sys.stderr)
                    errors += 1
                    continue
                problem = validate_example(obj)
                if problem:
                    print(f"  ✗ {path}:{lineno} {problem}", file=sys.stderr)
                    errors += 1
                    continue
                out.write(json.dumps(obj, ensure_ascii=False) + "\n")
                kept += 1

    print(f"\nMerged {kept} examples into {out_path} ({errors} skipped, {total} seen).")
    if kept < 1000:
        print("⚠️  Fewer than 1,000 examples — training results will be weak.")
    elif kept < 5000:
        print("ℹ️  Aim for ≥ 5,000 examples before a serious training run.")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
