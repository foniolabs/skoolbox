# SkoolBox offline voice setup (Windows)
# Populates the bundled voice pack for Tauri builds AND the runtime app-data folder.
# Schools receive voice assets inside the installer — no separate download at runtime.

param(
    [string]$AppDataDir = "$env:APPDATA\com.foniolabs.skoolbox",
    [string]$BundleDir = (Join-Path $PSScriptRoot "..\src-tauri\resources\voice")
)

$ErrorActionPreference = "Stop"

$ttsDir = Join-Path $AppDataDir "tts"
$whisperDir = Join-Path $AppDataDir "whisper"
$piperDir = Join-Path $ttsDir "piper"
$bundleTtsDir = Join-Path $BundleDir "tts"
$bundleWhisperDir = Join-Path $BundleDir "whisper"
$bundlePiperDir = Join-Path $bundleTtsDir "piper"
$tmp = Join-Path $env:TEMP "skoolbox-voice-setup"

New-Item -ItemType Directory -Force -Path $ttsDir, $whisperDir, $piperDir, $bundleTtsDir, $bundleWhisperDir, $bundlePiperDir, $tmp | Out-Null

function Download-File($Url, $Dest) {
    Write-Host "  -> $Dest"
    if (Test-Path $Dest) { Remove-Item $Dest -Force }
    Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing
}

function Expand-Zip($Zip, $Dest) {
    if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    Expand-Archive -Path $Zip -DestinationPath $Dest -Force
}

function Copy-VoiceTree($SourceTts, $SourceWhisper) {
    if (Test-Path $SourceTts) {
        Copy-Item -Path (Join-Path $SourceTts "*") -Destination $bundleTtsDir -Recurse -Force
    }
    if (Test-Path $SourceWhisper) {
        Copy-Item -Path (Join-Path $SourceWhisper "*") -Destination $bundleWhisperDir -Recurse -Force
    }
}

Write-Host "`nSkoolBox voice setup" -ForegroundColor Cyan
Write-Host "App data:  $AppDataDir"
Write-Host "Bundle dir: $BundleDir`n"

# -- Piper TTS (optional but recommended) -------------------------------------
Write-Host "[1/3] Piper TTS + English voice model..." -ForegroundColor Yellow
$piperZip = Join-Path $tmp "piper_windows_amd64.zip"
$piperUrl = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip"
Download-File $piperUrl $piperZip
$piperExtract = Join-Path $tmp "piper"
Expand-Zip $piperZip $piperExtract

$piperExe = Get-ChildItem -Path $piperExtract -Recurse -Filter "piper.exe" | Select-Object -First 1
if (-not $piperExe) { throw "piper.exe not found in Piper release archive." }
Copy-Item $piperExe.FullName (Join-Path $piperDir "piper.exe") -Force
Copy-Item $piperExe.FullName (Join-Path $bundlePiperDir "piper.exe") -Force
$piperParent = $piperExe.DirectoryName
Get-ChildItem $piperParent -Filter "*.dll" | ForEach-Object {
    Copy-Item $_.FullName $piperDir -Force
    Copy-Item $_.FullName $bundlePiperDir -Force
}

$voiceOnnx = Join-Path $ttsDir "en_GB-alan-medium.onnx"
$voiceJson = Join-Path $ttsDir "en_GB-alan-medium.onnx.json"
$bundleVoiceOnnx = Join-Path $bundleTtsDir "en_GB-alan-medium.onnx"
$bundleVoiceJson = Join-Path $bundleTtsDir "en_GB-alan-medium.onnx.json"
if (-not (Test-Path $voiceOnnx)) {
    Download-File "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx" $voiceOnnx
}
if (-not (Test-Path $voiceJson)) {
    Download-File "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json" $voiceJson
}
Copy-Item $voiceOnnx $bundleVoiceOnnx -Force
Copy-Item $voiceJson $bundleVoiceJson -Force
Write-Host "  Piper ready.`n" -ForegroundColor Green

# -- whisper.cpp binary -------------------------------------------------------
Write-Host "[2/3] whisper.cpp CLI (Windows x64)..." -ForegroundColor Yellow
$whisperZip = Join-Path $tmp "whisper-bin-x64.zip"
$whisperUrl = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.6/whisper-bin-x64.zip"
Download-File $whisperUrl $whisperZip
$whisperExtract = Join-Path $tmp "whisper"
Expand-Zip $whisperZip $whisperExtract

$whisperCli = Get-ChildItem -Path $whisperExtract -Recurse -Filter "whisper-cli.exe" | Select-Object -First 1
if (-not $whisperCli) {
    $whisperCli = Get-ChildItem -Path $whisperExtract -Recurse -Filter "main.exe" | Select-Object -First 1
}
if (-not $whisperCli) { throw "whisper-cli.exe / main.exe not found in whisper.cpp release." }
Copy-Item $whisperCli.FullName (Join-Path $whisperDir "whisper-cli.exe") -Force
Copy-Item $whisperCli.FullName (Join-Path $bundleWhisperDir "whisper-cli.exe") -Force
Write-Host "  whisper-cli.exe ready.`n" -ForegroundColor Green

# -- Whisper model (ggml-small ~466 MB) ---------------------------------------
Write-Host "[3/3] ggml-small.bin model (this may take a few minutes)..." -ForegroundColor Yellow
$modelPath = Join-Path $whisperDir "ggml-small.bin"
$bundleModelPath = Join-Path $bundleWhisperDir "ggml-small.bin"
if (-not (Test-Path $modelPath)) {
    Download-File "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin" $modelPath
} else {
    Write-Host "  Model already present in app data, skipping download."
}
Copy-Item $modelPath $bundleModelPath -Force
Write-Host "  Model ready.`n" -ForegroundColor Green

Write-Host "Done." -ForegroundColor Cyan
Write-Host "  Runtime dir: $AppDataDir"
Write-Host "  Bundle dir:  $BundleDir"
Write-Host "`nThe bundle dir is included in the Tauri installer (resources/voice/**)."
Write-Host "On first launch the app copies bundled voice assets into app data automatically."
