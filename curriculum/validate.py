#!/usr/bin/env python3
"""Validate the curriculum framework files in curriculum/.

Each curriculum/<key>.json describes one curriculum: its levels, subjects, and
representative standards. The Tauri app seeds its curriculum tables from these,
so they must be well-formed and internally consistent.

Usage:
    python curriculum/validate.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REQUIRED_TOP = ("key", "name", "authority", "levels", "subjects")


def validate_file(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [f"invalid JSON: {e}"]

    for field in REQUIRED_TOP:
        if field not in data:
            errors.append(f"missing top-level '{field}'")
    if errors:
        return errors

    if data["key"] != path.stem:
        errors.append(f"key '{data['key']}' should match filename '{path.stem}'")

    # Levels: unique keys, unique orders, required fields.
    level_keys, orders = set(), set()
    for lv in data["levels"]:
        for f in ("key", "name", "stage", "order"):
            if f not in lv:
                errors.append(f"level {lv.get('key', '?')} missing '{f}'")
        k = lv.get("key")
        if k in level_keys:
            errors.append(f"duplicate level key '{k}'")
        level_keys.add(k)
        o = lv.get("order")
        if o in orders:
            errors.append(f"duplicate level order '{o}'")
        orders.add(o)

    # Subjects: unique keys, required fields.
    subject_keys = set()
    for sub in data["subjects"]:
        for f in ("key", "name"):
            if f not in sub:
                errors.append(f"subject {sub.get('key', '?')} missing '{f}'")
        k = sub.get("key")
        if k in subject_keys:
            errors.append(f"duplicate subject key '{k}'")
        subject_keys.add(k)

    # Standards (optional): must reference existing subject + level.
    for st in data.get("standards", []):
        for f in ("code", "subject", "level", "title"):
            if f not in st:
                errors.append(f"standard {st.get('code', '?')} missing '{f}'")
        if st.get("subject") not in subject_keys:
            errors.append(f"standard {st.get('code')} -> unknown subject '{st.get('subject')}'")
        if st.get("level") not in level_keys:
            errors.append(f"standard {st.get('code')} -> unknown level '{st.get('level')}'")
    return errors


def main() -> int:
    root = Path(__file__).parent
    files = sorted(p for p in root.glob("*.json"))
    if not files:
        print("No curriculum/*.json files found.", file=sys.stderr)
        return 1

    total_errors = 0
    print(f"{'CURRICULUM':<14}{'LEVELS':>8}{'SUBJECTS':>10}{'STANDARDS':>11}  STATUS")
    for path in files:
        errs = validate_file(path)
        if errs:
            total_errors += len(errs)
            print(f"{path.stem:<14}{'':>8}{'':>10}{'':>11}  ✗")
            for e in errs:
                print(f"    - {e}", file=sys.stderr)
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        print(f"{path.stem:<14}{len(data['levels']):>8}{len(data['subjects']):>10}"
              f"{len(data.get('standards', [])):>11}  ✓")

    if total_errors:
        print(f"\n{total_errors} problem(s) found.", file=sys.stderr)
        return 1
    print(f"\nAll {len(files)} curriculum frameworks valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
