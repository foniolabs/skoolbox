# Bundled offline voice pack (Piper TTS + whisper.cpp STT)

Shipped inside the SkoolBox installer via `tauri.conf.json` → `resources/voice/**`.

## Layout

```
voice/
  tts/
    piper/          # piper.exe + DLLs
    *.onnx          # neural voice model
    *.onnx.json
  whisper/
    whisper-cli.exe
    ggml-small.bin
```

## Producers — populate before release build

```powershell
.\scripts\setup-voice.ps1
```

This downloads assets into **this folder** and `%APPDATA%\com.foniolabs.skoolbox`.
Large files (`*.onnx`, `*.bin`) are tracked with Git LFS.

## Schools — no manual setup

On first launch the app copies the bundled pack into app data automatically.
TTS falls back to Windows SAPI only if the bundle is missing (dev builds).
