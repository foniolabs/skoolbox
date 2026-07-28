#!/usr/bin/env bash
# One-time voice setup for SkoolBox — Phase 4 (SKILL.md).
#
# Installs the chosen neural TTS engine, **Kokoro** (decision locked 2026-07-10),
# where the app's `tts.rs` discovers it at runtime:
#
#   ~/.local/share/com.foniolabs.skoolbox/tts/kokoro/
#     koko                          ← CLI binary (built from the Kokoros repo)
#     checkpoints/kokoro-v1.0.onnx  ← model (~310 MB)
#     data/voices-v1.0.bin          ← voice styles (~27 MB)
#
# Optionally (--with-whisper) also fetches the Whisper Small model for the
# Phase 4 STT work into ~/.local/share/com.foniolabs.skoolbox/stt/.
#
# Safe to re-run: downloads resume, existing files are kept.
set -euo pipefail

TTS_HOME="${HOME}/.local/share/com.foniolabs.skoolbox/tts"
KOKORO="${TTS_HOME}/kokoro"
STT_HOME="${HOME}/.local/share/com.foniolabs.skoolbox/stt"
KOKORO_RELEASE="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
KOKOROS_REPO="https://github.com/lucasjinreal/Kokoros"

say() { printf '\n\033[1;32m== %s\033[0m\n' "$*"; }

command -v wget >/dev/null || { echo "wget is required"; exit 1; }

# ── 1. Kokoro model + voices (no sudo needed) ────────────────────────────────
say "Downloading Kokoro model + voices into ${KOKORO}"
mkdir -p "${KOKORO}/checkpoints" "${KOKORO}/data"
wget -c -q --show-progress "${KOKORO_RELEASE}/kokoro-v1.0.onnx" -O "${KOKORO}/checkpoints/kokoro-v1.0.onnx"
wget -c -q --show-progress "${KOKORO_RELEASE}/voices-v1.0.bin"  -O "${KOKORO}/data/voices-v1.0.bin"

# ── 2. Optional: Whisper Small model + whisper-cli for STT ───────────────────
if [[ "${1:-}" == "--with-whisper" ]]; then
  say "Downloading Whisper Small (ggml) into ${STT_HOME}"
  mkdir -p "${STT_HOME}"
  wget -c -q --show-progress \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin" \
    -O "${STT_HOME}/ggml-small.bin"

  if [[ -x "${STT_HOME}/whisper-cli" ]]; then
    say "whisper-cli already installed — skipping build"
  else
    command -v cmake >/dev/null || { echo "cmake is required to build whisper-cli:"; echo "    sudo apt-get install -y cmake"; exit 1; }
    say "Building whisper-cli from whisper.cpp (a few minutes, one time)"
    WTMP="$(mktemp -d)"
    git clone --depth 1 https://github.com/ggerganov/whisper.cpp "${WTMP}/whisper.cpp"
    # Static build → one self-contained binary, no .so files to ship around.
    cmake -S "${WTMP}/whisper.cpp" -B "${WTMP}/whisper.cpp/build" \
      -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF >/dev/null
    cmake --build "${WTMP}/whisper.cpp/build" --config Release -j"$(nproc)" --target whisper-cli >/dev/null
    cp "${WTMP}/whisper.cpp/build/bin/whisper-cli" "${STT_HOME}/whisper-cli"
    rm -rf "${WTMP}"
    say "whisper-cli installed at ${STT_HOME}/whisper-cli"
  fi
fi

# ── 3. Build the koko CLI (needs cargo + pkg-config + libopus-dev) ───────────
if [[ -x "${KOKORO}/koko" ]]; then
  say "koko CLI already installed — skipping build"
else
  command -v cargo >/dev/null || { echo "cargo (Rust) is required to build koko"; exit 1; }
  # Full preflight: koko links opus + espeak-ng's sonic/pcaudio; cmake builds
  # onnxruntime (and whisper.cpp). Catch everything in ONE apt line.
  can_link() { echo 'int main(){return 0;}' | cc -x c - "$1" -o /dev/null 2>/dev/null; }
  MISSING=""
  pkg-config --exists opus 2>/dev/null || MISSING+=" libopus-dev"
  command -v cmake >/dev/null          || MISSING+=" cmake"
  can_link -lsonic                     || MISSING+=" libsonic-dev"
  can_link -lpcaudio                   || MISSING+=" libpcaudio-dev"
  if [[ -n "${MISSING}" ]]; then
    echo
    echo "Missing build dependencies. Install them, then re-run this script:"
    echo "    sudo apt-get install -y${MISSING}"
    exit 1
  fi
  # espeak-rs-sys runs bindgen, which needs clang's builtin headers (stddef.h).
  # If the libclang-dev headers aren't installed, fall back to GCC's copies.
  if ! ls /usr/lib/clang/*/include/stddef.h /usr/lib/llvm-*/lib/clang/*/include/stddef.h >/dev/null 2>&1; then
    GCC_INC="$(ls -d /usr/lib/gcc/x86_64-linux-gnu/*/include 2>/dev/null | sort -V | tail -1)"
    if [[ -n "${GCC_INC}" && -f "${GCC_INC}/stddef.h" ]]; then
      export BINDGEN_EXTRA_CLANG_ARGS="-I${GCC_INC}"
      echo "(bindgen workaround: using ${GCC_INC} for clang builtin headers;"
      echo " the clean fix is: sudo apt-get install -y libclang-18-dev)"
    else
      echo "clang builtin headers missing. Install them, then re-run:"
      echo "    sudo apt-get install -y libclang-18-dev"
      exit 1
    fi
  fi
  say "Building the koko CLI from ${KOKOROS_REPO} (a few minutes, one time)"
  # Persistent build dir: a failed attempt (missing dep, Ctrl-C) resumes
  # incrementally instead of recompiling everything from scratch.
  BUILD_DIR="${HOME}/.cache/skoolbox-build/Kokoros"
  if [[ -d "${BUILD_DIR}/.git" ]]; then
    git -C "${BUILD_DIR}" pull --ff-only || true
  else
    mkdir -p "$(dirname "${BUILD_DIR}")"
    git clone --depth 1 "${KOKOROS_REPO}" "${BUILD_DIR}"
  fi
  # koko looks for checkpoints/ and data/ relative to its cwd — reuse ours so
  # the build doesn't re-download the model.
  ln -sfn "${KOKORO}/checkpoints" "${BUILD_DIR}/checkpoints"
  ln -sfn "${KOKORO}/data"        "${BUILD_DIR}/data"
  (cd "${BUILD_DIR}" && cargo build --release)
  cp "${BUILD_DIR}/target/release/koko" "${KOKORO}/koko"
  # koko's phonemizer needs espeak-ng-data at runtime; the binary's built-in
  # path points INTO the build tree, so ship a copy beside the binary and set
  # ESPEAK_DATA_PATH (tts.rs does the same). Without it koko silently emits
  # ~0.4 s stub audio.
  ESPEAK_SRC="$(ls -d "${BUILD_DIR}"/target/release/build/espeak-rs-sys-*/out/share/espeak-ng-data 2>/dev/null | head -1)"
  [[ -z "${ESPEAK_SRC}" && -d /usr/lib/x86_64-linux-gnu/espeak-ng-data ]] && ESPEAK_SRC=/usr/lib/x86_64-linux-gnu/espeak-ng-data
  [[ -n "${ESPEAK_SRC}" ]] || { echo "Could not find espeak-ng-data to install"; exit 1; }
  rm -rf "${KOKORO}/espeak-ng-data"
  cp -r "${ESPEAK_SRC}" "${KOKORO}/espeak-ng-data"
  rm -rf "${BUILD_DIR}"  # ~/.cache build tree is no longer needed once installed
fi

# ── 4. Smoke test ────────────────────────────────────────────────────────────
say "Smoke test — synthesizing a Martha line"
OUT="$(mktemp --suffix=.wav)"
(cd "${KOKORO}" && ESPEAK_DATA_PATH="${KOKORO}" ./koko -s af_heart -p 0.92 text --output "${OUT}" \
  "Good day, class! I am Martha. Today we are learning about fractions.")
# A phonemizer failure yields a ~0.4 s (~80 KB) stub — treat that as FAILED.
SIZE="$(stat -c%s "${OUT}" 2>/dev/null || echo 0)"
if [[ "${SIZE}" -lt 150000 ]]; then
  echo "SMOKE TEST FAILED: output too short (${SIZE} bytes) — phonemizer data problem?"
  exit 1
fi
echo "Wrote ${OUT} ($((SIZE / 1024)) KB) — play it with:  paplay ${OUT}"
echo
say "Done. SkoolBox will now prefer the Kokoro voice automatically (tts.rs)."
