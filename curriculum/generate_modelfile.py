#!/usr/bin/env python3
"""Generate src-tauri/ai/Martha.Modelfile from the single persona source.

The persona lives in ONE place: curriculum/nigerian.system_prompt.txt. The Rust
runtime compiles it in via include_str! (see src-tauri/src/ai/agent_prompt.rs);
this script keeps the Ollama Modelfile's SYSTEM block in sync with the same file
so `ollama create martha` builds the exact same persona used in the app.

Usage:
    python curriculum/generate_modelfile.py            # regenerate the Modelfile
    python curriculum/generate_modelfile.py --check    # fail if it is out of date
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PERSONA = REPO / "curriculum" / "nigerian.system_prompt.txt"
CONFIG = REPO / "skoolbox-config.json"
MODELFILE = REPO / "src-tauri" / "ai" / "Martha.Modelfile"

HEADER = """# Martha — SkoolBox's offline Nigerian-teacher persona.
#
# GENERATED FILE — do not edit by hand.
# Source of truth: curriculum/nigerian.system_prompt.txt
# Regenerate:      python curriculum/generate_modelfile.py
#
# Build it:   ollama create martha -f src-tauri/ai/Martha.Modelfile
# Test it:    ollama run martha "Teach me how to add fractions"
#
# NOTE: The SkoolBox app passes the same persona + curriculum context per request
# (compiled in via include_str!), so it does NOT depend on this Modelfile. This
# `martha` model exists for quick manual testing of the persona without running
# the whole app.
"""


def render() -> str:
    persona = PERSONA.read_text(encoding="utf-8").strip()
    base = "qwen3:4b"
    if CONFIG.exists():
        base = json.loads(CONFIG.read_text(encoding="utf-8")).get("model", {}).get("base", base)
    # Escape triple quotes so the SYSTEM heredoc stays valid.
    persona = persona.replace('"""', '\\"\\"\\"')
    return (
        f"{HEADER}\n"
        f"FROM {base}\n\n"
        "# Lower temperature = consistent teaching, fewer hallucinated \"facts\".\n"
        "PARAMETER temperature 0.4\n"
        "PARAMETER repeat_penalty 1.1\n"
        "# Room for curriculum context + chat history.\n"
        "PARAMETER num_ctx 8192\n\n"
        f'SYSTEM """{persona}"""\n'
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true",
                        help="exit non-zero if the Modelfile is out of date")
    args = parser.parse_args()

    rendered = render()
    if args.check:
        current = MODELFILE.read_text(encoding="utf-8") if MODELFILE.exists() else ""
        if current != rendered:
            print("Martha.Modelfile is out of date — run "
                  "`python curriculum/generate_modelfile.py`", file=sys.stderr)
            return 1
        print("Martha.Modelfile is up to date.")
        return 0

    MODELFILE.write_text(rendered, encoding="utf-8")
    print(f"Wrote {MODELFILE.relative_to(REPO)} from {PERSONA.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
