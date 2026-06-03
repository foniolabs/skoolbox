use crate::db::DbState;
use tauri::State;

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
