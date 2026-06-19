# `training/` — LoRA Fine-Tuning Pipeline

> 🔵 **Developers (ML) only.** Non-technical team members do not need anything here.

Turns the team's [`../dataset/`](../dataset/) examples into a quantized GGUF model
that ships inside the SkoolBox app. Fine-tuning needs a GPU — use Google Colab Pro
(A100) or RunPod (RTX 4090 / A100 40GB). Cost ≈ $10–25 per run.

## Pipeline

```
dataset/*.jsonl
   │  merge_dataset.py        (CPU, no GPU)
   ▼
training/skoolbox_train.jsonl
   │  train.py                (GPU, 2–8 hrs)  →  skoolbox-lora-adapters/
   ▼
   │  merge_lora.py           (GPU)           →  skoolbox-merged/ (~8 GB)
   ▼
   │  convert_to_gguf.py      (CPU + llama.cpp) → app/models/*.gguf (~2.6 GB)
   ▼
   Test via Ollama  →  ship in the Tauri app
```

## Setup (once)

```bash
pip install -r training/requirements.txt
# For the GGUF step, also clone + build llama.cpp and set LLAMA_CPP_DIR.
```

## Run

```bash
# 1. Combine all team data (run from repo root)
python training/merge_dataset.py --input dataset/ --output training/skoolbox_train.jsonl
wc -l training/skoolbox_train.jsonl     # aim for ≥ 5,000 lines

# 2. LoRA fine-tune (curriculum blended with a general Qwen-style dataset)
python training/train.py \
    --model qwen3-4b \
    --dataset training/skoolbox_train.jsonl \
    --mix-dataset trl-lib/Capybara \
    --mix-ratio 0.3 \
    --output training/skoolbox-lora-adapters \
    --epochs 3 --lora-r 16

# 3. Merge adapters into the base model
python training/merge_lora.py \
    --base qwen3-4b \
    --adapter training/skoolbox-lora-adapters \
    --output training/skoolbox-merged

# 4. Quantize to GGUF (output lands where the app loads models from)
python training/convert_to_gguf.py \
    --input training/skoolbox-merged \
    --output ../src-tauri/ai/models/skoolbox-qwen3-4b-v1.0-Q4_K_M.gguf \
    --quantize Q4_K_M
```

## Blending in a general Qwen-style dataset

We **blend** a slice of a public instruction dataset with our curriculum data.
This keeps Martha's general conversational ability and reduces "catastrophic
forgetting" (where fine-tuning on a narrow dataset makes the model worse at
everything else), while still teaching the NERDC/WAEC curriculum.

- `--mix-dataset` — a Hugging Face dataset id or a local `.jsonl` path. Default
  recommendation: [`trl-lib/Capybara`](https://huggingface.co/datasets/trl-lib/Capybara)
  (already in the standard `messages` chat format). Other common options:
  `HuggingFaceH4/ultrachat_200k`, `Open-Orca/SlimOrca`, `teknium/OpenHermes-2.5`.
- `--mix-ratio` — fraction of the blend that is general data. `0.3` means 30%
  general / 70% curriculum. Set `0` (or omit `--mix-dataset`) to train on
  curriculum only.

`train.py` auto-converts common dataset schemas to the chat format it needs
(`messages`, ShareGPT `conversations`, Alpaca `instruction/input/output`, and
`prompt/completion`). Qwen3 ships its own chat template, so no template override
is needed.

> ⚠️ Verify any Hugging Face dataset id exists and is licensed for your use
> before a run — dataset names on the Hub change over time.

## Training parameters

| Flag | Meaning | Default |
| --- | --- | --- |
| `--epochs` | Passes over all examples | 3 (5 for large datasets) |
| `--lora-r` | Adapter size / capacity | 16 |
| `--lora-alpha` | Scaling factor | 2× lora-r |
| `--batch-size` | Examples at once (lower if OOM) | 4 |
| `--learning-rate` | Adjustment speed | 2e-4 |
| `--mix-dataset` | General dataset to blend in | (none) |
| `--mix-ratio` | Share of general data in the blend | 0.3 |

⚠️ **Overfitting:** loss below ~0.1 with strange answers means the model
memorised the data. Drop `--epochs` to 2 or add more diverse examples.

## Test before releasing

The Ollama Modelfile lives at [`../src-tauri/ai/Martha.Modelfile`](../src-tauri/ai/Martha.Modelfile).

```bash
ollama create skoolbox -f ../src-tauri/ai/Martha.Modelfile
ollama run skoolbox
```

Checklist: Primary 4 maths (age-appropriate language), JSS2 (NERDC-aligned),
SS3 (WAEC exam format), off-curriculum question (declines gracefully), Pidgin
English (responds helpfully).

## Versioning

`skoolbox-qwen3-4b-v1.0-Q4_K_M.gguf` → bump `v1.1` for added data, `v2.0` for a
major curriculum update. GGUF files are large — track them with **Git LFS**
(`git lfs install && git lfs track "*.gguf"`).

## Output artifacts (git-ignored)

`skoolbox_train.jsonl`, `skoolbox-lora-adapters/`, `skoolbox-merged/`, and
`*-checkpoints/` are build artifacts — see [`.gitignore`](../.gitignore).
