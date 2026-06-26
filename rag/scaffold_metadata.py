#!/usr/bin/env python3
"""Generate / refresh metadata.json for every dataset class folder.

The metadata.json file is the contract between a class folder's content and the
RAG retrieval layer (see docs/CURRICULUM_ARCHITECTURE.md §3). Hand-maintaining
one per class folder is error-prone, so this script scaffolds them from the
folder structure plus the curriculum framework in curriculum/<curriculum>.json.

It is idempotent and *non-destructive by default*: the `topics` list and the
`textbooks` list of an existing metadata.json are preserved (subject experts own
those), while structural fields (class_level, exam flags, retrieval weights) are
refreshed to stay consistent with this script.

Usage:
    python rag/scaffold_metadata.py                 # all curricula under dataset/
    python rag/scaffold_metadata.py --curriculum nigerian
    python rag/scaffold_metadata.py --check         # fail if anything is missing/stale
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATASET = REPO / "dataset"
CURRICULUM_DIR = REPO / "curriculum"

# Tiered-retrieval defaults for exam classes (doc §3.2 / §4.3).
TIERED_WEIGHTS = {"own_class": 0.70, "prerequisites": 0.25, "exam_bank": 0.05}

# Per-curriculum facts the folder tree cannot express on its own.
# class_level -> (age_range, exam_body, is_exam_class, prerequisite_levels, exam_bank_files)
NIGERIAN_CLASSES = {
    "primary1": ("6-7", "FSLC, Common Entrance", False, [], []),
    "primary2": ("7-8", "FSLC, Common Entrance", False, [], []),
    "primary3": ("8-9", "FSLC, Common Entrance", False, [], []),
    "primary4": ("9-10", "FSLC, Common Entrance", False, [], []),
    "primary5": ("10-11", "Common Entrance", True,
                 ["primary1", "primary2", "primary3", "primary4"],
                 ["common_entrance_past_questions"]),
    "primary6": ("11-12", "FSLC, Common Entrance", True,
                 ["primary1", "primary2", "primary3", "primary4", "primary5"],
                 ["fslc_past_questions", "common_entrance_past_questions"]),
    "jss1": ("12-13", "WAEC BECE", False, [], []),
    "jss2": ("13-14", "WAEC BECE", False, [], []),
    "jss3": ("14-15", "WAEC BECE", True, ["jss1", "jss2"],
             ["waec_bece_past_questions"]),
    "ss1": ("15-16", "WAEC SSCE, NECO", False, [], []),
    "ss2": ("16-17", "WAEC SSCE, NECO", False, [], []),
    "ss3": ("17-18", "WAEC SSCE, NECO", True, ["ss1", "ss2"],
            ["waec_ssce_past_questions", "neco_past_questions"]),
}

CURRICULUM_CLASSES = {"nigerian": NIGERIAN_CLASSES}


def load_framework(curriculum: str) -> dict:
    path = CURRICULUM_DIR / f"{curriculum}.json"
    if not path.exists():
        raise SystemExit(f"error: no curriculum framework at {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def topics_from_folder(folder: Path) -> list[str]:
    """Derive a topic list from the .jsonl filenames in a class folder.

    Exam-bank files (named *_past_questions.jsonl) are not topics.
    """
    topics = []
    for f in sorted(folder.glob("*.jsonl")):
        if f.stem.endswith("past_questions"):
            continue
        topics.append(f.stem.replace("_", " "))
    return topics


def build_metadata(curriculum: str, framework: dict, subject: str,
                   class_level: str, folder: Path, existing: dict) -> dict:
    facts = CURRICULUM_CLASSES[curriculum][class_level]
    age_range, exam_body, is_exam, prereqs, _ = facts
    display = next(
        (l["name"] for l in framework.get("levels", []) if l["key"] == class_level),
        class_level,
    )

    # Subject experts own these; preserve what they wrote, else derive/seed.
    topics = existing.get("topics") or topics_from_folder(folder)
    textbooks = existing.get("textbooks") or []

    meta = {
        "curriculum": curriculum,
        "subject": subject,
        "class_level": class_level,
        "class_display": display,
        "age_range": age_range,
        "exam_body": exam_body,
        "is_exam_class": is_exam,
        "prerequisite_levels": prereqs,
        "retrieval_mode": "tiered" if is_exam else "standard",
    }
    if is_exam:
        meta["retrieval_weights"] = TIERED_WEIGHTS
    meta["textbooks"] = textbooks
    meta["topics"] = topics
    return meta


def exam_bank_stub_path(curriculum: str, subject: str, class_level: str,
                        folder: Path, name: str) -> Path:
    return folder / f"{name}.jsonl"


def main() -> int:
    ap = argparse.ArgumentParser(description="Scaffold dataset metadata.json files.")
    ap.add_argument("--curriculum", default=None,
                    help="Only this curriculum (default: every dir under dataset/)")
    ap.add_argument("--check", action="store_true",
                    help="Exit non-zero if any metadata.json is missing or stale")
    args = ap.parse_args()

    curricula = ([args.curriculum] if args.curriculum
                 else sorted(p.name for p in DATASET.iterdir()
                             if p.is_dir() and (p / "..").exists()
                             and p.name in CURRICULUM_CLASSES))
    written, stale = 0, 0
    for curriculum in curricula:
        framework = load_framework(curriculum)
        croot = DATASET / curriculum
        for class_folder in sorted(croot.glob("*/*/*")):  # subject/phase/class
            if not class_folder.is_dir():
                continue
            subject = class_folder.relative_to(croot).parts[0]
            class_level = class_folder.name
            if class_level not in CURRICULUM_CLASSES[curriculum]:
                print(f"  ! unknown class '{class_level}' in {class_folder}",
                      file=sys.stderr)
                continue
            meta_path = class_folder / "metadata.json"
            existing = (json.loads(meta_path.read_text(encoding="utf-8"))
                        if meta_path.exists() else {})
            meta = build_metadata(curriculum, framework, subject,
                                  class_level, class_folder, existing)
            new_text = json.dumps(meta, indent=2, ensure_ascii=False) + "\n"
            if not meta_path.exists() or meta_path.read_text(encoding="utf-8") != new_text:
                stale += 1
                if args.check:
                    print(f"  STALE/MISSING: {meta_path.relative_to(REPO)}")
                else:
                    meta_path.write_text(new_text, encoding="utf-8")
                    written += 1

            # Seed empty exam-bank stub files so the slots are visible.
            if not args.check:
                _, _, is_exam, _, exam_files = CURRICULUM_CLASSES[curriculum][class_level]
                for name in exam_files:
                    stub = exam_bank_stub_path(curriculum, subject, class_level,
                                               class_folder, name)
                    if not stub.exists():
                        stub.write_text("", encoding="utf-8")

    if args.check:
        if stale:
            print(f"\n{stale} metadata file(s) missing or out of date. "
                  f"Run: python rag/scaffold_metadata.py")
            return 1
        print("All metadata.json files present and current.")
        return 0
    print(f"Wrote/updated {written} metadata.json file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
