//! Offline speech-to-text — Phase 4 push-to-talk (SKILL.md, MARTHA_PERSONA §3).
//!
//! Flow: spacebar (frontend) → `stt_start` records the mic → `stt_stop` stops
//! the recorder and runs whisper.cpp on the WAV → transcript returned to the
//! frontend, which shows it for teacher confirmation BEFORE Martha responds.
//!
//! Same engine-discovery pattern as `tts.rs` — assets live under
//! `~/.local/share/com.foniolabs.skoolbox/stt/` (installed by
//! `scripts/setup_voice.sh --with-whisper`):
//!   stt/whisper-cli     — whisper.cpp CLI binary
//!   stt/ggml-small.bin  — Whisper Small model
//!
//! RAM-budget properties (SKILL.md Phase 4):
//! - Whisper runs as a transient process per transcription, so it "unloads"
//!   the moment it exits, and can never be resident at the same time as TTS
//!   (we also stop any speech before recording starts).
//! - `stt_available` returns false when available RAM < 6 GB, so the UI
//!   auto-falls back to text-only with a clear message.
//! - Failed/empty transcriptions are logged (WAV kept) under `stt/failed/`
//!   for a future Nigerian-English fine-tune.

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

/// The in-flight recording: the recorder process and the WAV it writes.
struct Recording {
    child: std::process::Child,
    wav: PathBuf,
}

fn current_recording() -> &'static Mutex<Option<Recording>> {
    static R: OnceLock<Mutex<Option<Recording>>> = OnceLock::new();
    R.get_or_init(|| Mutex::new(None))
}

/// SkoolBox STT asset directory (whisper binary + model live here).
fn stt_home() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(PathBuf::from(home).join(".local/share/com.foniolabs.skoolbox/stt"))
}

/// (whisper-cli binary, ggml model) if the STT engine is installed.
fn whisper_paths() -> Option<(PathBuf, PathBuf)> {
    let dir = stt_home()?;
    let bin = dir.join("whisper-cli");
    if !bin.exists() {
        return None;
    }
    let model = std::fs::read_dir(&dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("ggml-") && n.ends_with(".bin"))
        })?;
    Some((bin, model))
}

/// First available microphone recorder, with args that produce the 16 kHz
/// mono s16 WAV whisper.cpp requires. `arecord` gets a 31 s hard cap as a
/// backstop; the frontend stops recording at 30 s.
fn recorder_command(wav: &std::path::Path) -> Option<std::process::Command> {
    let candidates: [(&str, Vec<String>); 3] = [
        (
            "arecord",
            vec![
                "-q".into(), "-f".into(), "S16_LE".into(), "-r".into(), "16000".into(),
                "-c".into(), "1".into(), "-d".into(), "31".into(),
                wav.to_string_lossy().into_owned(),
            ],
        ),
        (
            "pw-record",
            vec![
                "--rate".into(), "16000".into(), "--channels".into(), "1".into(),
                "--format".into(), "s16".into(), wav.to_string_lossy().into_owned(),
            ],
        ),
        (
            "parecord",
            vec![
                "--format=s16le".into(), "--rate=16000".into(), "--channels=1".into(),
                wav.to_string_lossy().into_owned(),
            ],
        ),
    ];
    for (bin, args) in candidates {
        if which_exists(bin) {
            let mut c = std::process::Command::new(bin);
            c.args(&args)
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null());
            return Some(c);
        }
    }
    None
}

fn which_exists(bin: &str) -> bool {
    std::process::Command::new("which")
        .arg(bin)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Available system RAM in GiB (Linux). Errs on the side of "enough" if
/// /proc/meminfo can't be read (non-Linux dev machines).
fn available_ram_gib() -> f64 {
    let Ok(text) = std::fs::read_to_string("/proc/meminfo") else {
        return f64::MAX;
    };
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("MemAvailable:") {
            let kb: f64 = rest
                .split_whitespace()
                .next()
                .and_then(|v| v.parse().ok())
                .unwrap_or(f64::MAX);
            return kb / 1024.0 / 1024.0;
        }
    }
    f64::MAX
}

/// Voice auto-disables when available RAM < 6 GB (SKILL.md Phase 4).
const MIN_RAM_GIB: f64 = 6.0;

/// Stop a recorder gracefully (SIGTERM so the WAV header is finalised —
/// `Child::kill` would SIGKILL and corrupt the file), then reap it.
fn stop_recorder(mut rec: Recording) -> PathBuf {
    let _ = std::process::Command::new("kill")
        .arg(rec.child.id().to_string())
        .status();
    let _ = rec.child.wait();
    rec.wav
}

/// Append one line to the failed-transcriptions log and keep the WAV for a
/// future Nigerian-English fine-tune (SKILL.md Phase 4).
fn log_failure(wav: &std::path::Path, reason: &str) {
    let Some(dir) = stt_home() else { return };
    let failed = dir.join("failed");
    let _ = std::fs::create_dir_all(&failed);
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let kept = failed.join(format!("{ts}.wav"));
    let _ = std::fs::rename(wav, &kept);
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("failed_transcriptions.log"))
    {
        let _ = writeln!(f, "{ts}\t{reason}\t{}", kept.display());
    }
}

/// Is push-to-talk usable right now? False when the whisper engine or a
/// recorder is missing, or available RAM is under the 6 GB voice budget —
/// the UI then falls back to text-only with a clear message.
#[tauri::command]
pub async fn stt_available() -> bool {
    whisper_paths().is_some()
        && recorder_command(std::path::Path::new("/dev/null")).is_some()
        && available_ram_gib() >= MIN_RAM_GIB
}

/// Start recording the microphone (push-to-talk pressed). Stops any ongoing
/// Martha speech first — Whisper and TTS are never active simultaneously.
#[tauri::command]
pub async fn stt_start() -> Result<(), String> {
    if whisper_paths().is_none() {
        return Err("Voice input is not installed on this machine (run scripts/setup_voice.sh --with-whisper).".into());
    }
    if available_ram_gib() < MIN_RAM_GIB {
        return Err("Not enough free memory for voice input right now — please type instead.".into());
    }
    // Never record while Martha is speaking (and don't transcribe her voice).
    let _ = super::tts::stop_speaking().await;

    let mut guard = current_recording().lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("Already recording.".into());
    }
    let wav = std::env::temp_dir().join(format!("skoolbox_stt_{}.wav", std::process::id()));
    let _ = std::fs::remove_file(&wav);
    let mut cmd = recorder_command(&wav)
        .ok_or("No microphone recorder found (need arecord, pw-record or parecord).")?;
    let child = cmd.spawn().map_err(|e| format!("Could not start recording: {e}"))?;
    *guard = Some(Recording { child, wav });
    Ok(())
}

/// Discard the current recording (push-to-talk cancelled).
#[tauri::command]
pub async fn stt_cancel() -> Result<(), String> {
    let rec = current_recording().lock().map_err(|e| e.to_string())?.take();
    if let Some(rec) = rec {
        let wav = stop_recorder(rec);
        let _ = std::fs::remove_file(&wav);
    }
    Ok(())
}

/// Stop recording and transcribe. Returns the transcript for the on-screen
/// preview — the teacher confirms it before Martha responds.
#[tauri::command]
pub async fn stt_stop() -> Result<String, String> {
    let rec = current_recording()
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or("Not recording.")?;
    let wav = stop_recorder(rec);

    let size = std::fs::metadata(&wav).map(|m| m.len()).unwrap_or(0);
    if size < 8_000 {
        // < ~0.25 s of audio — nothing worth transcribing.
        let _ = std::fs::remove_file(&wav);
        return Err("I didn't catch that — hold the mic a little longer.".into());
    }

    let (bin, model) = whisper_paths().ok_or("Voice input is not installed.")?;
    let out_base = wav.with_extension(""); // whisper writes <base>.txt

    // Transient process: exits (and frees all model RAM) as soon as it's done.
    let status = tokio::process::Command::new(&bin)
        .arg("-m").arg(&model)
        .arg("-f").arg(&wav)
        .arg("-l").arg("en")
        .arg("--no-prints")
        .arg("-otxt")
        .arg("-of").arg(&out_base)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(|e| format!("Whisper failed to start: {e}"))?;

    let txt_path = out_base.with_extension("txt");
    if !status.success() {
        log_failure(&wav, "whisper_exit_error");
        let _ = std::fs::remove_file(&txt_path);
        return Err("Transcription failed — please type the question instead.".into());
    }

    let text = std::fs::read_to_string(&txt_path).unwrap_or_default();
    let _ = std::fs::remove_file(&txt_path);
    let cleaned = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.is_empty() {
        log_failure(&wav, "empty_transcription");
        return Err("I couldn't make out any words — please try again or type it.".into());
    }

    let _ = std::fs::remove_file(&wav);
    Ok(cleaned)
}
