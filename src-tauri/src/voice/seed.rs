//! Copy bundled voice assets into app data on first launch.
//! Producers populate `src-tauri/resources/voice/` before building the installer.

use crate::voice::paths::VoicePaths;
use std::path::Path;
use tauri::{AppHandle, Manager};

const BUNDLED_VOICE_ROOT: &str = "resources/voice";
const SEED_MARKER: &str = ".bundled-voice-seeded";

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.is_dir() {
        return Err(format!("Bundled voice path missing: {}", src.display()));
    }
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let target = dst.join(entry.file_name());
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            std::fs::copy(entry.path(), &target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn piper_present(tts_dir: &Path) -> bool {
    let bin = if cfg!(windows) {
        tts_dir.join("piper").join("piper.exe")
    } else {
        tts_dir.join("piper").join("piper")
    };
    if !bin.exists() {
        return false;
    }
    std::fs::read_dir(tts_dir)
        .ok()
        .and_then(|entries| {
            entries
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .find(|p| p.extension().and_then(|s| s.to_str()) == Some("onnx"))
        })
        .is_some()
}

fn already_seeded(paths: &VoicePaths) -> bool {
    paths.root.join(SEED_MARKER).exists()
}

/// If app data is missing voice assets, copy the bundled pack from the installer.
pub fn seed_bundled_voice_if_needed(app: &AppHandle, paths: &VoicePaths) {
    if already_seeded(paths) {
        return;
    }

    let stt_ready = crate::voice::stt::status(paths).available;
    let tts_ready = piper_present(&paths.tts_dir);
    if stt_ready && tts_ready {
        let _ = std::fs::write(paths.root.join(SEED_MARKER), "ok");
        return;
    }

    let bundled_root = match app
        .path()
        .resolve(BUNDLED_VOICE_ROOT, tauri::path::BaseDirectory::Resource)
    {
        Ok(p) if p.is_dir() => p,
        _ => {
            log::info!("No bundled voice pack in this build — using platform fallbacks / manual setup");
            return;
        }
    };

    let bundled_tts = bundled_root.join("tts");
    let bundled_whisper = bundled_root.join("whisper");

    if bundled_tts.is_dir() && !tts_ready {
        match copy_dir_recursive(&bundled_tts, &paths.tts_dir) {
            Ok(()) => log::info!("Seeded bundled Piper TTS into app data"),
            Err(e) => log::warn!("Failed to seed bundled TTS: {e}"),
        }
    }

    if bundled_whisper.is_dir() && !stt_ready {
        match copy_dir_recursive(&bundled_whisper, &paths.whisper_dir) {
            Ok(()) => log::info!("Seeded bundled Whisper STT into app data"),
            Err(e) => log::warn!("Failed to seed bundled STT: {e}"),
        }
    }

    if crate::voice::stt::status(paths).available || piper_present(&paths.tts_dir) {
        let _ = std::fs::write(paths.root.join(SEED_MARKER), "ok");
    }
}
