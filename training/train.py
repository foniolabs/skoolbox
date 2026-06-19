#!/usr/bin/env python3
"""LoRA fine-tune Qwen3 4B on the SkoolBox curriculum, blended with a general
Qwen-style instruction dataset.

Blending a slice of a public instruction dataset (e.g. trl-lib/Capybara) with our
Nigerian curriculum examples keeps Martha's general ability and reduces
"catastrophic forgetting", while still teaching the NERDC/WAEC curriculum. The
mix ratio controls how much of the blend is general data.

Run on a GPU (Google Colab Pro A100, or RunPod RTX 4090 / A100 40GB).
Unsloth makes LoRA training ~2x faster with ~70% less VRAM.

Install (once):
    pip install unsloth transformers datasets trl peft accelerate bitsandbytes

Usage:
    python training/train.py \
        --model qwen3-4b \
        --dataset training/skoolbox_train.jsonl \
        --mix-dataset trl-lib/Capybara \
        --mix-ratio 0.3 \
        --output training/skoolbox-lora-adapters \
        --epochs 3 --lora-r 16

Set --mix-ratio 0 (or omit --mix-dataset) to train on curriculum data only.

Watch for overfitting: if training loss drops below ~0.1 but answers get strange,
the model is memorising. Reduce --epochs to 2 or add more diverse examples.
"""
from __future__ import annotations

import argparse

# Base model repo on Hugging Face for the --model shorthand.
MODEL_MAP = {
    "qwen3-4b": "unsloth/Qwen3-4B",
}


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="LoRA fine-tune Qwen3 4B for SkoolBox.")
    ap.add_argument("--model", default="qwen3-4b", help="Base model (key in MODEL_MAP or HF id)")
    ap.add_argument("--dataset", default="training/skoolbox_train.jsonl",
                    help="Curriculum JSONL from merge_dataset.py (the primary data)")
    ap.add_argument("--mix-dataset", default="",
                    help="HF id or local path of a general instruction dataset to "
                         "blend in (e.g. trl-lib/Capybara). Empty = curriculum only.")
    ap.add_argument("--mix-ratio", type=float, default=0.3,
                    help="Fraction of the blend that is general data (0.0–0.9)")
    ap.add_argument("--mix-split", default="train", help="Split of the mix dataset")
    ap.add_argument("--output", default="training/skoolbox-lora-adapters",
                    help="Where to save the LoRA adapters")
    ap.add_argument("--epochs", type=int, default=3,
                    help="Passes over the data (3; use 5 for larger datasets)")
    ap.add_argument("--lora-r", type=int, default=16, help="LoRA rank / capacity")
    ap.add_argument("--lora-alpha", type=int, default=None,
                    help="LoRA scaling (defaults to 2x lora-r)")
    ap.add_argument("--batch-size", type=int, default=4,
                    help="Per-device batch size (reduce to 2 if OOM)")
    ap.add_argument("--learning-rate", type=float, default=2e-4, help="Learning rate")
    ap.add_argument("--max-seq-len", type=int, default=8192, help="Max sequence length")
    ap.add_argument("--seed", type=int, default=42, help="Shuffle / sampling seed")
    return ap.parse_args()


def normalize_to_messages(example: dict) -> dict | None:
    """Coerce common instruction-dataset schemas to {"messages": [...]}.

    Supports: chat ({"messages"}), ShareGPT ({"conversations":[{from,value}]}),
    Alpaca ({"instruction","input","output"}), and prompt/completion pairs.
    Returns None if the row can't be understood (it is then dropped).
    """
    if isinstance(example.get("messages"), list) and example["messages"]:
        return {"messages": example["messages"]}

    if isinstance(example.get("conversations"), list):
        role_map = {"human": "user", "user": "user",
                    "gpt": "assistant", "assistant": "assistant", "system": "system"}
        msgs = [{"role": role_map.get(t.get("from", ""), "user"),
                 "content": t.get("value", "")}
                for t in example["conversations"] if t.get("value")]
        return {"messages": msgs} if msgs else None

    if example.get("instruction") and example.get("output"):
        user = example["instruction"]
        if example.get("input"):
            user += "\n\n" + example["input"]
        return {"messages": [{"role": "user", "content": user},
                             {"role": "assistant", "content": example["output"]}]}

    if example.get("prompt") and example.get("completion"):
        return {"messages": [{"role": "user", "content": example["prompt"]},
                             {"role": "assistant", "content": example["completion"]}]}
    return None


def build_dataset(args):
    """Load curriculum data, optionally blend in general data, shuffle."""
    from datasets import load_dataset, concatenate_datasets

    curriculum = load_dataset("json", data_files=args.dataset, split="train")
    n_curr = len(curriculum)
    print(f"Curriculum examples: {n_curr}")

    if not args.mix_dataset or args.mix_ratio <= 0:
        return curriculum.shuffle(seed=args.seed)

    ratio = min(max(args.mix_ratio, 0.0), 0.9)
    # n_mix / (n_curr + n_mix) = ratio  ->  n_mix = n_curr * ratio / (1 - ratio)
    n_mix = int(round(n_curr * ratio / (1 - ratio)))
    print(f"Blending in {n_mix} general examples from {args.mix_dataset} "
          f"(target {ratio:.0%} of blend)")

    src = "json" if args.mix_dataset.endswith((".json", ".jsonl")) else args.mix_dataset
    mix = (load_dataset("json", data_files=args.mix_dataset, split="train")
           if src == "json" else load_dataset(args.mix_dataset, split=args.mix_split))
    mix = mix.shuffle(seed=args.seed).select(range(min(n_mix, len(mix))))
    mix = (mix.map(normalize_to_messages, remove_columns=mix.column_names)
              .filter(lambda r: r.get("messages")))

    blended = concatenate_datasets([
        curriculum.select_columns(["messages"]), mix
    ]).shuffle(seed=args.seed)
    print(f"Blended dataset size: {len(blended)} "
          f"({n_curr} curriculum + {len(blended) - n_curr} general)")
    return blended


def main() -> None:
    args = parse_args()
    lora_alpha = args.lora_alpha or args.lora_r * 2
    base_model = MODEL_MAP.get(args.model, args.model)

    # Imported here so --help works without a GPU / heavy deps installed.
    from unsloth import FastLanguageModel
    from trl import SFTTrainer, SFTConfig

    print(f"Loading base model: {base_model}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=base_model,
        max_seq_length=args.max_seq_len,
        load_in_4bit=True,
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        lora_alpha=lora_alpha,
        lora_dropout=0.0,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth",
    )

    # Qwen3 ships its own chat template in the tokenizer — use it directly.
    if tokenizer.chat_template is None:
        from unsloth.chat_templates import get_chat_template
        tokenizer = get_chat_template(tokenizer, chat_template="qwen-2.5")

    dataset = build_dataset(args)

    def format_chat(example):
        return {"text": tokenizer.apply_chat_template(
            example["messages"], tokenize=False, add_generation_prompt=False)}

    dataset = dataset.map(format_chat)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        args=SFTConfig(
            per_device_train_batch_size=args.batch_size,
            gradient_accumulation_steps=4,
            num_train_epochs=args.epochs,
            learning_rate=args.learning_rate,
            warmup_ratio=0.03,
            logging_steps=10,
            optim="adamw_8bit",
            lr_scheduler_type="cosine",
            seed=args.seed,
            output_dir=f"{args.output}-checkpoints",
        ),
    )

    print(f"Starting training: {args.epochs} epochs, lora_r={args.lora_r}, "
          f"alpha={lora_alpha}, bs={args.batch_size}, lr={args.learning_rate}")
    trainer.train()

    print(f"Saving LoRA adapters to {args.output}")
    model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)
    print("Done. Next: merge_lora.py, then convert_to_gguf.py")


if __name__ == "__main__":
    main()
