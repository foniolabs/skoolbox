//! Offline text-to-speech — Piper (neural) with platform fallbacks.

use crate::voice::paths::VoicePaths;
use crate::voice::speech::clean_for_speech;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Mutex, OnceLock};
use tokio::io::AsyncWriteExt;

fn audio_pid() -> &'static Mutex<Option<u32>> {
    static P: OnceLock<Mutex<Option<u32>>> = OnceLock::new();
    P.get_or_init(|| Mutex::new(None))
}

fn piper_paths(tts_dir: &Path) -> Option<(PathBuf, PathBuf)> {
    let bin = if cfg!(windows) {
        tts_dir.join("piper").join("piper.exe")
    } else {
        tts_dir.join("piper").join("piper")
    };
    if !bin.exists() {
        return None;
    }
    let model = std::fs::read_dir(tts_dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| p.extension().and_then(|s| s.to_str()) == Some("onnx"))?;
    Some((bin, model))
}

async fn play_wav(path: &Path) -> Result<(), String> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || play_wav_blocking(&path))
        .await
        .map_err(|e| e.to_string())?
}

fn play_wav_blocking(path: &Path) -> Result<(), String> {
    use rodio::{Decoder, OutputStream, Sink};
    use std::fs::File;
    use std::io::BufReader;

    let (_stream, stream_handle) =
        OutputStream::try_default().map_err(|e| format!("No audio output device: {e}"))?;
    let sink = Sink::try_new(&stream_handle).map_err(|e| e.to_string())?;
    let file = File::open(path).map_err(|e| e.to_string())?;
    let source = Decoder::new(BufReader::new(file)).map_err(|e| e.to_string())?;
    sink.append(source);
    sink.sleep_until_end();
    Ok(())
}

async fn speak_with_piper(text: &str, bin: &Path, model: &Path) -> Result<(), String> {
    let wav = std::env::temp_dir().join(format!("skoolbox_tts_{}.wav", std::process::id()));

    let mut child = tokio::process::Command::new(bin)
        .arg("--model")
        .arg(model)
        .arg("--output_file")
        .arg(&wav)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Piper failed to start: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(text.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
    }
    let status = child.wait().await.map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("Piper synthesis failed.".to_string());
    }

    let result = play_wav(&wav).await;
    let _ = std::fs::remove_file(&wav);
    result
}

#[cfg(windows)]
async fn speak_windows_sapi(text: &str) -> Result<(), String> {
    let escaped = text.replace('\'', "''");
    let script = format!(
        "Add-Type -AssemblyName System.Speech; \
         $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; \
         $s.Rate = -2; \
         $s.Speak('{escaped}')"
    );
    let mut child = tokio::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .spawn()
        .map_err(|e| format!("Windows speech unavailable: {e}"))?;

    if let Some(id) = child.id() {
        *audio_pid().lock().unwrap() = Some(id);
    }
    let status = child.wait().await.map_err(|e| e.to_string())?;
    *audio_pid().lock().unwrap() = None;
    if status.success() {
        Ok(())
    } else {
        Err("Windows speech engine returned an error.".to_string())
    }
}

#[cfg(not(windows))]
async fn speak_linux_spd(text: &str) -> Result<(), String> {
    let status = tokio::process::Command::new("spd-say")
        .args(["-w", "-l", "en", "-r", "-10", "--", text])
        .status()
        .await
        .map_err(|e| format!("Speech engine unavailable (install speech-dispatcher): {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("Speech engine returned an error.".to_string())
    }
}

/// Speak cleaned text aloud; blocks until playback finishes.
pub async fn speak(paths: &VoicePaths, text: &str) -> Result<(), String> {
    let cleaned = clean_for_speech(text);
    if cleaned.trim().is_empty() {
        return Ok(());
    }

    if let Some((bin, model)) = piper_paths(&paths.tts_dir) {
        if speak_with_piper(&cleaned, &bin, &model).await.is_ok() {
            return Ok(());
        }
    }

    #[cfg(windows)]
    {
        return speak_windows_sapi(&cleaned).await;
    }

    #[cfg(not(windows))]
    {
        speak_linux_spd(&cleaned).await
    }
}

/// Interrupt any in-flight speech.
pub async fn stop() -> Result<(), String> {
    let pid = audio_pid().lock().unwrap().take();
    if let Some(pid) = pid {
        #[cfg(windows)]
        {
            let _ = tokio::process::Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F", "/T"])
                .output()
                .await;
        }
        #[cfg(not(windows))]
        {
            let _ = tokio::process::Command::new("kill")
                .arg(pid.to_string())
                .output()
                .await;
        }
    }

    #[cfg(not(windows))]
    {
        let _ = tokio::process::Command::new("spd-say").arg("-S").output().await;
    }

    Ok(())
}

#[derive(serde::Serialize)]
pub struct TtsStatus {
    pub available: bool,
    pub engine: String,
}

pub fn status(paths: &VoicePaths) -> TtsStatus {
    if piper_paths(&paths.tts_dir).is_some() {
        return TtsStatus {
            available: true,
            engine: "piper".to_string(),
        };
    }
    #[cfg(windows)]
    {
        return TtsStatus {
            available: true,
            engine: "windows-sapi".to_string(),
        };
    }
    #[cfg(not(windows))]
    {
        let spd = std::process::Command::new("spd-say")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        TtsStatus {
            available: spd,
            engine: if spd {
                "spd-say".to_string()
            } else {
                "none".to_string()
            },
        }
    }
}
