#!/usr/bin/env python3
"""Turn a scanned/printed textbook (or past-question paper) into searchable
curriculum knowledge for the SkoolBox RAG index.

This is the **content-prep** companion to rag/ingest.py. It runs once on your
laptop (never in the classroom) and does the heavy lifting of reading a PDF or
scanned pages:

    scanned PDF / page images ──OCR──▶ cleaned text ──▶ a .txt artifact in the
    dataset class folder ──(rag/ingest.py)──▶ SQLite FTS5 knowledge base

Why write a .txt artifact instead of going straight to the database? Because the
shipped curriculum.db must stay **reproducible from dataset/** (see SKILL.md
"Cross-cutting: packaging"). The OCR'd text becomes a reviewable file you own and
can correct by hand; rag/ingest.py then rebuilds the index from it. So OCR runs
once, but you can re-ingest any time without re-scanning.

Inputs supported:
  * .pdf  — digital (text layer used directly) OR scanned (each page is OCR'd)
  * image — .png/.jpg/.jpeg/.tif/.tiff, or a FOLDER of page images (sorted)
  * .txt/.md — already-extracted text (no OCR needed; handy for your own notes)

OCR needs Tesseract + PyMuPDF (one-time install — see rag/requirements-ocr.txt):
    sudo apt-get install tesseract-ocr          # the OCR engine
    pip install -r rag/requirements-ocr.txt      # PyMuPDF, pytesseract, Pillow

Examples:
    # A scanned Basic Science chapter for JSS1
    python rag/ingest_textbook.py --input ~/scans/basic_science_jss1_ch3.pdf \\
        --curriculum nigerian --subject basic_science --class-level jss1 \\
        --topic "living and non-living things"

    # A folder of photographed past-question pages
    python rag/ingest_textbook.py --input ~/scans/bece_2023/ \\
        --curriculum nigerian --subject mathematics --class-level jss3 \\
        --source-type past_questions --topic "waec bece"

    # Then build the index (same command as for the Q&A data):
    python rag/ingest.py --curriculum nigerian --db src-tauri/curriculum.db
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATASET = REPO / "dataset"

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"}

# Heuristic: if a PDF page already yields this many characters of real text, it
# has a digital text layer and we skip OCR for that page (faster, cleaner).
TEXT_LAYER_MIN_CHARS = 40


def phase_for_class(class_level: str) -> str:
    """primary5 -> 'primary', jss3 -> 'jss', ss1 -> 'ss'."""
    cl = class_level.lower()
    for phase in ("primary", "jss", "ss"):
        if cl.startswith(phase):
            return phase
    raise SystemExit(f"error: cannot derive phase from class level '{class_level}' "
                     f"(expected primaryN / jssN / ssN)")


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.strip().lower()).strip("_")
    return slug or "untitled"


# ── Text extraction ──────────────────────────────────────────────────────────

def _require(module: str, pip_name: str, extra: str = ""):
    try:
        return __import__(module)
    except ImportError:
        raise SystemExit(
            f"error: '{module}' is required for OCR but is not installed.\n"
            f"  pip install -r rag/requirements-ocr.txt   (installs {pip_name})\n"
            + (extra and f"  {extra}\n")
        )


def ocr_image(path: Path, lang: str) -> str:
    Image = _require("PIL", "Pillow").Image  # type: ignore[attr-defined]
    pytesseract = _require(
        "pytesseract", "pytesseract",
        extra="and the Tesseract engine: sudo apt-get install tesseract-ocr")
    try:
        return pytesseract.image_to_string(Image.open(path), lang=lang)
    except pytesseract.TesseractNotFoundError:
        raise SystemExit(
            "error: the Tesseract OCR engine is not installed.\n"
            "  sudo apt-get install tesseract-ocr   (Debian/Ubuntu)\n"
            "  choco install tesseract              (Windows)\n")


def extract_pdf(path: Path, lang: str, dpi: int) -> str:
    fitz = _require("fitz", "PyMuPDF")
    pytesseract = _require(
        "pytesseract", "pytesseract",
        extra="and the Tesseract engine: sudo apt-get install tesseract-ocr")
    Image = _require("PIL", "Pillow").Image  # type: ignore[attr-defined]

    pages: list[str] = []
    with fitz.open(path) as doc:
        for i, page in enumerate(doc, 1):
            text = page.get_text().strip()
            if len(text) >= TEXT_LAYER_MIN_CHARS:
                pages.append(text)  # digital page — use its text layer
                continue
            # Scanned page: rasterize then OCR.
            pix = page.get_pixmap(dpi=dpi)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            try:
                pages.append(pytesseract.image_to_string(img, lang=lang))
            except pytesseract.TesseractNotFoundError:
                raise SystemExit(
                    "error: the Tesseract OCR engine is not installed.\n"
                    "  sudo apt-get install tesseract-ocr\n")
            print(f"  · OCR'd page {i}", file=sys.stderr)
    return "\n\n".join(pages)


def extract_text(input_path: Path, lang: str, dpi: int) -> str:
    if input_path.is_dir():
        images = sorted(p for p in input_path.iterdir()
                        if p.suffix.lower() in IMAGE_EXTS)
        if not images:
            raise SystemExit(f"error: no images found in folder {input_path}")
        print(f"  OCR'ing {len(images)} page image(s)…", file=sys.stderr)
        return "\n\n".join(ocr_image(p, lang) for p in images)

    suffix = input_path.suffix.lower()
    if suffix in (".txt", ".md"):
        return input_path.read_text(encoding="utf-8")
    if suffix == ".pdf":
        return extract_pdf(input_path, lang, dpi)
    if suffix in IMAGE_EXTS:
        return ocr_image(input_path, lang)
    raise SystemExit(f"error: unsupported input type '{suffix}'. Use a PDF, an "
                     f"image, a folder of images, or a .txt/.md file.")


# ── Cleanup (light — chunking in ingest.py normalises whitespace anyway, but a
#    readable artifact makes your hand-review much easier) ─────────────────────

def clean_text(text: str) -> str:
    # Join words hyphenated across a line break: "photo-\nsynthesis" -> "photosynthesis".
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    lines = []
    for line in text.splitlines():
        line = line.rstrip()
        if re.fullmatch(r"\s*\d{1,4}\s*", line):  # drop bare page-number lines
            continue
        lines.append(line)
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)  # collapse big blank runs
    return text.strip() + "\n"


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(
        description="OCR a textbook/past-question into a dataset .txt artifact.")
    ap.add_argument("--input", required=True,
                    help="PDF, image, folder of images, or .txt/.md file")
    ap.add_argument("--curriculum", required=True)
    ap.add_argument("--subject", required=True,
                    help="folder name, e.g. basic_science, mathematics, english")
    ap.add_argument("--class-level", required=True, dest="class_level",
                    help="primaryN / jssN / ssN")
    ap.add_argument("--topic", required=True,
                    help="topic/chapter name (becomes the artifact filename + tag)")
    ap.add_argument("--source-type", default="textbook",
                    choices=["textbook", "past_questions"])
    ap.add_argument("--lang", default="eng", help="Tesseract language (default eng)")
    ap.add_argument("--dpi", type=int, default=300,
                    help="rasterization DPI for scanned PDF pages (default 300)")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the extracted text instead of writing the artifact")
    ap.add_argument("--ingest", action="store_true",
                    help="after writing, run scaffold_metadata.py + ingest.py for "
                         "this curriculum to rebuild the index")
    args = ap.parse_args()

    input_path = Path(args.input).expanduser()
    if not input_path.exists():
        raise SystemExit(f"error: input not found: {input_path}")

    text = clean_text(extract_text(input_path, args.lang, args.dpi))
    if not text.strip():
        raise SystemExit("error: no text was extracted (blank scan or failed OCR?)")

    if args.dry_run:
        sys.stdout.write(text)
        return 0

    phase = phase_for_class(args.class_level)
    folder = DATASET / args.curriculum / args.subject / phase / args.class_level
    folder.mkdir(parents=True, exist_ok=True)

    stem = slugify(args.topic)
    if args.source_type == "past_questions" and not stem.endswith("past_questions"):
        stem = f"{stem}_past_questions"
    out_path = folder / f"{stem}.txt"
    out_path.write_text(text, encoding="utf-8")
    print(f"Wrote {out_path.relative_to(REPO)} ({len(text):,} chars)")

    if args.ingest:
        subprocess.run([sys.executable, "rag/scaffold_metadata.py",
                        "--curriculum", args.curriculum], cwd=REPO, check=True)
        subprocess.run([sys.executable, "rag/ingest.py",
                        "--curriculum", args.curriculum,
                        "--db", "src-tauri/curriculum.db"], cwd=REPO, check=True)
    else:
        print("\nNext steps:")
        print("  python rag/scaffold_metadata.py --curriculum "
              f"{args.curriculum}   # refresh metadata (topics list)")
        print("  python rag/ingest.py --curriculum "
              f"{args.curriculum} --db src-tauri/curriculum.db   # build the index")
        print("  # review the .txt artifact and fix any OCR mistakes before ingesting")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
