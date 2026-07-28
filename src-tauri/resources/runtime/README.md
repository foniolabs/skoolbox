# `resources/runtime/` — the bundled offline model runtime

Everything the app needs to run Qwen **with no internet and no manual Ollama
install** ships from this folder. At launch, `src-tauri/src/ai/runtime.rs`:

1. runs the `ollama` binary from here (falling back to a system install in dev),
2. starts `ollama serve` pointed at a per-install model store, and
3. on first run, imports the model with
   `ollama create martha -f Martha.offline.Modelfile` — entirely from local disk.

## What lives here

| File | In git? | Notes |
| --- | --- | --- |
| `Martha.offline.Modelfile` | ✅ yes | `FROM ./skoolbox-qwen.gguf` — imports the local GGUF, no registry pull. |
| `skoolbox-qwen.gguf` | ❌ no (Git LFS / added on build machine) | The ~2 GB Qwen model. **You add this.** |
| `ollama` / `ollama.exe` | ❌ no (added per-platform on build machine) | The Ollama binary for the target OS. **You add this.** |

The two big/binary files are **not committed** — they're added on the machine
that builds the installer (see the size/licensing notes below), then picked up
by the `resources` map in `tauri.conf.json`.

## Producing an installer (do this on the target-OS build machine)

**1. Drop in the model.** Put a Qwen GGUF here named exactly `skoolbox-qwen.gguf`.
   For the MVP that's the base model, e.g.:
   ```
   # from an internet-connected machine, once:
   huggingface-cli download Qwen/Qwen2.5-3B-Instruct-GGUF qwen2.5-3b-instruct-q4_k_m.gguf \
     --local-dir . && mv qwen2.5-3b-instruct-q4_k_m.gguf skoolbox-qwen.gguf
   ```
   (Later, swap in the fine-tuned `skoolbox-qwen3-4b-*.gguf` from `training/`.)

**2. Drop in the Ollama binary for the target OS.**
   - Windows: copy `ollama.exe` from an Ollama install (`%LOCALAPPDATA%\Programs\Ollama\ollama.exe`) into this folder.
   - Linux/macOS: copy the `ollama` binary (`which ollama`) here.

**3. Register both in `tauri.conf.json`** under `bundle.resources` (the
   `Martha.offline.Modelfile` entry is already there; add the two you just placed):
   ```json
   "resources": {
     "default_curriculum_pack.json": "default_curriculum_pack.json",
     "resources/runtime/Martha.offline.Modelfile": "runtime/Martha.offline.Modelfile",
     "resources/runtime/skoolbox-qwen.gguf": "runtime/skoolbox-qwen.gguf",
     "resources/runtime/ollama.exe": "runtime/ollama.exe"
   }
   ```
   > Only list files that exist, or `tauri build` fails. That's why the two
   > binaries are added here on the build machine, not committed.

**4. Build the installer** on the target OS: `npm run tauri build`.
   The result bundles app + Ollama + model. First launch on any offline machine
   seeds the model and runs — no internet, no `ollama pull`.

> ⚠️ **Verification status.** The runtime logic (auto-start against an isolated
> per-install store, offline serve) was proven on the dev machine. The **full
> ~2 GB GGUF seed (`ollama create martha -f Martha.offline.Modelfile`) has NOT
> been run end-to-end there** — the dev box was out of disk (only ~3.8 GB free)
> and swapping RAM. The `ollama create` command and the offline Modelfile
> (`FROM ./skoolbox-qwen.gguf`) are correct; **validate the seed here on the
> build machine**, where the model and disk headroom live, by running step 4 and
> confirming first launch imports `martha` with the network off.

## Notes
- **Installer size:** the GGUF dominates (~2 GB). Keep the whole installer under
  the 5 GB MVP target — the base Q4_K_M 3B leaves plenty of headroom.
- **Licensing:** Ollama is MIT; Qwen2.5 is Apache-2.0 — both fine to redistribute.
- **RAM:** the model loads on demand and unloads after `keep_alive` (30 min); an
  8 GB machine runs the 3B comfortably.
- Track the binaries with Git LFS if you ever do commit them
  (`.gitattributes` already covers `*.gguf`).
