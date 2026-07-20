//! Tauri commands for offline text-to-speech.

use crate::db::DbState;
use crate::voice::{VoiceState, tts};
use tauri::State;

#[tauri::command]
pub async fn speak_text(voice: State<'_, VoiceState>, text: String) -> Result<(), String> {
    tts::speak(&voice.paths, &text).await
}

#[tauri::command]
pub async fn stop_speaking(_voice: State<'_, VoiceState>) -> Result<(), String> {
    tts::stop().await
}

#[tauri::command]
pub fn tts_available(voice: State<'_, VoiceState>) -> bool {
    tts::status(&voice.paths).available
}

#[tauri::command]
pub fn get_voice_status(voice: State<'_, VoiceState>) -> crate::voice::VoiceStatus {
    voice.status()
}

/// Get the current TTS settings from the database.
#[tauri::command]
pub fn get_tts_settings(db: State<'_, DbState>) -> Result<TtsSettings, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    let voice = get_setting_value(&conn, "tts_voice").unwrap_or_else(|| "default".to_string());
    let speed = get_setting_value(&conn, "tts_speed").unwrap_or_else(|| "1.0".to_string());

    Ok(TtsSettings { voice, speed })
}

/// Save TTS settings to the database.
#[tauri::command]
pub fn save_tts_settings(
    db: State<'_, DbState>,
    voice: String,
    speed: String,
) -> Result<(), String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    set_setting_value(&conn, "tts_voice", &voice)?;
    set_setting_value(&conn, "tts_speed", &speed)?;
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
}
