//! Voice asset directories under the app data folder.

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Clone)]
pub struct VoicePaths {
    pub root: PathBuf,
    pub tts_dir: PathBuf,
    pub whisper_dir: PathBuf,
    pub stt_failures_log: PathBuf,
}

impl VoicePaths {
    pub fn from_app(app: &AppHandle) -> Result<Self, String> {
        let root = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Could not resolve app data dir: {e}"))?;
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;

        let tts_dir = root.join("tts");
        let whisper_dir = root.join("whisper");
        let stt_failures_log = root.join("stt_failures.logl");
        std::fs::create_dir_all(&tts_dir).ok();
        std::fs::create_dir_all(&whisper_dir).ok();

        Ok(Self {
            root,
            tts_dir,
            whisper_dir,
            stt_failures_log,
        })
    }
}
