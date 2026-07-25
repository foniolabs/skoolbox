use crate::db::DbState;
use tauri::State;

// ── Offline voice (Martha speaks aloud through the classroom speakers) ────────
//
// WebKitGTK's in-browser speechSynthesis has no voices on Linux, so we drive the
// system speech engine (speech-dispatcher / espeak-ng via `spd-say`) from Rust.
// This plays audio on the machine running SkoolBox — the classroom display.
// (A neural voice like Kokoro/Piper can replace this later for natural speech.)

/// Normalize text for speech: say maths symbols as words ("2/5" → "2 over 5")
/// and strip markdown / LaTeX so the voice reads clean prose.
fn clean_for_speech(text: &str) -> String {
    // 1. Maths symbols → spoken words (so "2/5 + 3/5 = 5/5" reads naturally).
    let mut s = text.to_string();
    for (from, to) in [
        ("\\frac", " "),
        ("\\times", " times "),
        ("\\div", " over "),
        ("/", " over "),
        ("+", " plus "),
        ("=", " equals "),
        (" x ", " times "),
        (" - ", " minus "),
        ("×", " times "),
        ("÷", " over "),
        ("%", " percent "),
        ("−", " minus "),
        ("≈", " approximately "),
        ("²", " squared "),
        ("³", " cubed "),
        ("°", " degrees "),
    ] {
        s = s.replace(from, to);
    }

    // 2. Strip markdown/LaTeX delimiters; turn newlines into short pauses.
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '*' | '#' | '`' | '_' | '$' | '\\' => continue,
            '(' | ')' | '[' | ']' | '{' | '}' => out.push(' '),
            '\n' => out.push_str(". "),
            _ => out.push(c),
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// PID of the currently-playing audio process, so speech can be interrupted.
fn current_audio_pid() -> &'static std::sync::Mutex<Option<u32>> {
    static P: std::sync::OnceLock<std::sync::Mutex<Option<u32>>> = std::sync::OnceLock::new();
    P.get_or_init(|| std::sync::Mutex::new(None))
}

/// SkoolBox TTS asset directory (Piper binary + voice models live here).
fn tts_home() -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(std::path::PathBuf::from(home).join(".local/share/com.foniolabs.skoolbox/tts"))
}

/// Kokoro — the chosen Phase 4 neural TTS engine (SKILL.md). The `koko` CLI
/// binary plus its model files live under `tts_home()/kokoro/` (installed by
/// `scripts/setup_voice.sh`):
///   kokoro/koko                            — CLI binary (Kokoros project)
///   kokoro/checkpoints/kokoro-v1.0.onnx    — model (~310 MB)
///   kokoro/data/voices-v1.0.bin            — voice styles
///   kokoro/espeak-ng-data/                 — phonemizer data (via ESPEAK_DATA_PATH)
/// `koko` resolves the model files relative to its working directory, so we
/// return the kokoro dir to use as cwd. Returns None unless everything exists —
/// without espeak-ng-data the phonemizer silently produces ~0.4 s stub audio.
fn kokoro_paths() -> Option<(std::path::PathBuf, std::path::PathBuf)> {
    let dir = tts_home()?.join("kokoro");
    let bin = dir.join("koko");
    let ok = bin.exists()
        && dir.join("checkpoints/kokoro-v1.0.onnx").exists()
        && dir.join("data/voices-v1.0.bin").exists()
        && dir.join("espeak-ng-data/phontab").exists();
    ok.then_some((bin, dir))
}

/// Synthesize with Kokoro (natural neural voice) and play the result.
async fn speak_with_kokoro(
    text: &str,
    bin: &std::path::Path,
    kokoro_dir: &std::path::Path,
) -> Result<(), String> {
    let wav = std::env::temp_dir().join(format!("skoolbox_tts_{}.wav", std::process::id()));
    // Martha's voice per MARTHA_PERSONA §3: warm female at 0.92× speed.
    // ESPEAK_DATA_PATH points koko's phonemizer at the data we ship beside it
    // (its build-time default path doesn't exist on school machines).
    let status = tokio::process::Command::new(bin)
        .current_dir(kokoro_dir)
        .env("ESPEAK_DATA_PATH", kokoro_dir)
        .arg("-s")
        .arg("af_heart")
        .arg("-p")
        .arg("0.92")
        .arg("text")
        .arg("--output")
        .arg(&wav)
        .arg(text)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(|e| format!("Kokoro failed to start: {e}"))?;
    if !status.success() || !wav.exists() {
        return Err("Kokoro synthesis failed.".to_string());
    }
    let result = play_wav(&wav).await;
    let _ = std::fs::remove_file(&wav);
    result
}

/// (piper binary, first .onnx voice model) if a Piper voice is installed.
fn piper_paths() -> Option<(std::path::PathBuf, std::path::PathBuf)> {
    let dir = tts_home()?;
    let bin = dir.join("piper/piper");
    if !bin.exists() {
        return None;
    }
    let model = std::fs::read_dir(&dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| p.extension().and_then(|s| s.to_str()) == Some("onnx"))?;
    Some((bin, model))
}

/// Play a WAV through the first available system player, tracking its PID so it
/// can be interrupted. Blocks until playback finishes.
async fn play_wav(path: &std::path::Path) -> Result<(), String> {
    let players: [(&str, &[&str]); 3] = [
        ("paplay", &[]),
        ("aplay", &["-q"]),
        ("ffplay", &["-nodisp", "-autoexit", "-loglevel", "quiet"]),
    ];
    for (cmd, args) in players {
        let mut c = tokio::process::Command::new(cmd);
        c.args(args).arg(path);
        match c.spawn() {
            Ok(mut child) => {
                if let Some(id) = child.id() {
                    *current_audio_pid().lock().unwrap() = Some(id);
                }
                let status = child.wait().await;
                *current_audio_pid().lock().unwrap() = None;
                if matches!(status, Ok(s) if s.success()) {
                    return Ok(());
                }
            }
            Err(_) => continue, // player not installed — try the next
        }
    }
    Err("No audio player available (paplay/aplay/ffplay).".to_string())
}

/// Synthesize with Piper (natural neural voice) and play the result.
async fn speak_with_piper(
    text: &str,
    bin: &std::path::Path,
    model: &std::path::Path,
) -> Result<(), String> {
    use tokio::io::AsyncWriteExt;
    let wav = std::env::temp_dir().join(format!("skoolbox_tts_{}.wav", std::process::id()));

    let mut child = tokio::process::Command::new(bin)
        .arg("--model")
        .arg(model)
        .arg("--output_file")
        .arg(&wav)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Piper failed to start: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(text.as_bytes()).await.map_err(|e| e.to_string())?;
        // stdin drops here → EOF, Piper begins synthesizing.
    }
    let status = child.wait().await.map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("Piper synthesis failed.".to_string());
    }

    let result = play_wav(&wav).await;
    let _ = std::fs::remove_file(&wav);
    result
}

/// Speak `text` aloud and resolve when finished.
/// Engine order: Kokoro (chosen neural voice) → Piper (legacy neural) →
/// system engine (`spd-say`) as the last resort.
#[tauri::command]
pub async fn speak_text(text: String) -> Result<(), String> {
    let cleaned = clean_for_speech(&text);
    if cleaned.trim().is_empty() {
        return Ok(());
    }

    if let Some((bin, dir)) = kokoro_paths() {
        if speak_with_kokoro(&cleaned, &bin, &dir).await.is_ok() {
            return Ok(());
        }
        // fall through if Kokoro hiccups
    }

    if let Some((bin, model)) = piper_paths() {
        if speak_with_piper(&cleaned, &bin, &model).await.is_ok() {
            return Ok(());
        }
        // fall through to the system engine if Piper hiccups
    }

    let status = tokio::process::Command::new("spd-say")
        .args(["-w", "-l", "en", "-r", "-10", "--", &cleaned])
        .status()
        .await
        .map_err(|e| format!("Speech engine unavailable (install speech-dispatcher / espeak-ng): {e}"))?;
    if !status.success() {
        return Err("Speech engine returned an error.".to_string());
    }
    Ok(())
}

/// Interrupt any ongoing speech (used when skipping/pausing the lesson).
#[tauri::command]
pub async fn stop_speaking() -> Result<(), String> {
    // Kill the current Piper playback, if any…
    let pid = current_audio_pid().lock().unwrap().take();
    if let Some(pid) = pid {
        let _ = tokio::process::Command::new("kill")
            .arg(pid.to_string())
            .output()
            .await;
    }
    // …and stop the espeak/speech-dispatcher fallback.
    let _ = tokio::process::Command::new("spd-say").arg("-S").output().await;
    Ok(())
}

/// Whether any offline speech engine is available (Piper or speech-dispatcher).
#[tauri::command]
pub async fn tts_available() -> bool {
    if kokoro_paths().is_some() || piper_paths().is_some() {
        return true;
    }
    tokio::process::Command::new("spd-say")
        .arg("--version")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Get the current TTS settings from the database.
#[tauri::command]
pub fn get_tts_settings(db: State<DbState>) -> Result<TtsSettings, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    let voice = get_setting_value(&conn, "tts_voice").unwrap_or_else(|| "Ezinne".to_string());
    let speed = get_setting_value(&conn, "tts_speed").unwrap_or_else(|| "1.0".to_string());
    let azure_key = get_setting_value(&conn, "azure_tts_key").unwrap_or_default();
    let azure_region =
        get_setting_value(&conn, "azure_tts_region").unwrap_or_else(|| "westeurope".to_string());

    Ok(TtsSettings {
        voice,
        speed,
        azure_key,
        azure_region,
    })
}

/// Save TTS settings to the database.
#[tauri::command]
pub fn save_tts_settings(
    db: State<DbState>,
    voice: String,
    speed: String,
    azure_key: String,
    azure_region: String,
) -> Result<(), String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    set_setting_value(&conn, "tts_voice", &voice)?;
    set_setting_value(&conn, "tts_speed", &speed)?;
    set_setting_value(&conn, "azure_tts_key", &azure_key)?;
    set_setting_value(&conn, "azure_tts_region", &azure_region)?;
    Ok(())
}

fn get_setting_value(conn: &rusqlite::Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
        row.get::<_, String>(0)
    })
    .ok()
}

fn set_setting_value(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
        rusqlite::params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(serde::Serialize)]
pub struct TtsSettings {
    pub voice: String,
    pub speed: String,
    pub azure_key: String,
    pub azure_region: String,
}
