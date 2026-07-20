//! Tauri commands for offline speech-to-text (push-to-activate).

use crate::voice::{VoiceState, stt};
use tauri::State;

#[tauri::command]
pub fn stt_start_listening(_voice: State<'_, VoiceState>) -> Result<(), String> {
    stt::start_listening()
}

#[tauri::command]
pub fn stt_stop_and_transcribe(voice: State<'_, VoiceState>) -> Result<String, String> {
    stt::stop_and_transcribe(&voice.paths)
}

#[tauri::command]
pub fn stt_cancel_listening(_voice: State<'_, VoiceState>) -> Result<(), String> {
    stt::cancel_listening();
    Ok(())
}

#[tauri::command]
pub fn stt_is_listening(_voice: State<'_, VoiceState>) -> bool {
    stt::is_listening()
}
