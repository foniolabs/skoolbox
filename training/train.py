#!/usr/bin/env python3
"""LoRA fine-tune Qwen3 4B on the SkoolBox dataset using Unsloth.

Run on a GPU (Google Colab Pro A100, or RunPod RTX 4090 / A100 40GB).
Unsloth makes LoRA training ~2x faster with ~70% less VRAM.

Install (once):
    pip install unsloth transformers datasets trl peft accelerate bitsandbytes

Usage:
    python training/train.py \
        --model qwen3-4b \
        --dataset training/skoolbox_train.jsonl \
        --output training/skoolbox-lora-adapters \
        --epochs 3 \
        --lora-r 16

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
                    help="Combined JSONL training file from merge_dataset.py")
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
    return ap.parse_args()


def main() -> None:
    args = parse_args()
    lora_alpha = args.lora_alpha or args.lora_r * 2
    base_model = MODEL_MAP.get(args.model, args.model)

    # Imported here so --help works without a GPU / heavy deps installed.
    from unsloth import FastLanguageModel
    from unsloth.chat_templates import get_chat_template
    from datasets import load_dataset
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

    tokenizer = get_chat_template(tokenizer, chat_template="qwen-2.5")

    def format_chat(example):
        text = tokenizer.apply_chat_template(
            example["messages"], tokenize=False, add_generation_prompt=False)
        return {"text": text}

    print(f"Loading dataset: {args.dataset}")
    dataset = load_dataset("json", data_files=args.dataset, split="train")
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
            seed=42,
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
