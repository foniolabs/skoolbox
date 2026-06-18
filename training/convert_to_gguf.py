#!/usr/bin/env python3
"""Quantize a merged model to GGUF for bundling with the SkoolBox app.

Q4_K_M quantization shrinks ~8 GB → ~2.6 GB with minimal quality loss, using
llama.cpp's convert + quantize tools. Set LLAMA_CPP_DIR to your llama.cpp clone,
or pass --llama-cpp.

Prereqs:
    git clone https://github.com/ggerganov/llama.cpp
    cd llama.cpp && make            # builds the quantize binary
    pip install -r requirements.txt # for convert_hf_to_gguf.py

Usage:
    python training/convert_to_gguf.py \
        --input training/skoolbox-merged \
        --output app/models/skoolbox-qwen3-4b-Q4_K_M.gguf \
        --quantize Q4_K_M
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def run(cmd: list[str]) -> None:
    print("+ " + " ".join(cmd))
    subprocess.run(cmd, check=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Quantize a merged model to GGUF.")
    ap.add_argument("--input", required=True, help="Merged model folder")
    ap.add_argument("--output", required=True, help="Output .gguf path")
    ap.add_argument("--quantize", default="Q4_K_M", help="Quantization type")
    ap.add_argument("--llama-cpp", default=os.environ.get("LLAMA_CPP_DIR", "llama.cpp"),
                    help="Path to a built llama.cpp checkout")
    args = ap.parse_args()

    llama = Path(args.llama_cpp)
    convert = llama / "convert_hf_to_gguf.py"
    quantize_bin = next((p for p in (llama / "llama-quantize",
                                     llama / "build" / "bin" / "llama-quantize",
                                     llama / "quantize") if p.exists()), None)
    if not convert.exists() or quantize_bin is None:
        print(f"error: llama.cpp tools not found under {llama}. "
              f"Clone and build it, or set --llama-cpp.", file=sys.stderr)
        return 1

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        f16 = Path(tmp) / "model-f16.gguf"
        print("Step 1/2: convert HF model to f16 GGUF")
        run([sys.executable, str(convert), args.input, "--outfile", str(f16),
             "--outtype", "f16"])
        print(f"Step 2/2: quantize to {args.quantize}")
        run([str(quantize_bin), str(f16), str(out), args.quantize])

    size_gb = out.stat().st_size / 1e9
    print(f"\nWrote {out} ({size_gb:.2f} GB).")
    print("Tip: track with Git LFS — `git lfs track \"*.gguf\"` before committing.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
