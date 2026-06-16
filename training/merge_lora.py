#!/usr/bin/env python3
"""Merge trained LoRA adapters into the base Qwen3 4B model.

Produces a full merged model folder (~8 GB in BF16). Not yet small enough to
bundle — pass it to convert_to_gguf.py next to quantize.

Usage:
    python training/merge_lora.py \
        --base qwen3-4b \
        --adapter training/skoolbox-lora-adapters \
        --output training/skoolbox-merged
"""
from __future__ import annotations

import argparse

MODEL_MAP = {
    "qwen3-4b": "unsloth/Qwen3-4B",
}


def main() -> None:
    ap = argparse.ArgumentParser(description="Merge LoRA adapters into base model.")
    ap.add_argument("--base", default="qwen3-4b", help="Base model key or HF id")
    ap.add_argument("--adapter", default="training/skoolbox-lora-adapters",
                    help="LoRA adapter folder from train.py")
    ap.add_argument("--output", default="training/skoolbox-merged",
                    help="Output folder for the merged model")
    args = ap.parse_args()

    base_model = MODEL_MAP.get(args.base, args.base)

    from unsloth import FastLanguageModel

    print(f"Loading base + adapter: {base_model} + {args.adapter}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.adapter,  # adapter folder also records its base model
        max_seq_length=8192,
        load_in_4bit=False,
    )

    print(f"Merging and saving (16-bit) to {args.output}")
    model.save_pretrained_merged(args.output, tokenizer, save_method="merged_16bit")
    print("Done. Next: convert_to_gguf.py")


if __name__ == "__main__":
    main()
