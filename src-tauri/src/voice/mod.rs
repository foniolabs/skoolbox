pub mod paths;
pub mod seed;
pub mod speech;
pub mod stt;
pub mod tts;

pub use paths::VoicePaths;
use serde::Serialize;

#[derive(Clone)]
pub struct VoiceState {
    pub paths: VoicePaths,
}

#[derive(Serialize)]
pub struct VoiceStatus {
    pub tts_available: bool,
    pub tts_engine: String,
    pub stt_available: bool,
    pub stt_engine: String,
    pub stt_listening: bool,
}

impl VoiceState {
    pub fn status(&self) -> VoiceStatus {
        let tts = tts::status(&self.paths);
        let stt = stt::status(&self.paths);
        VoiceStatus {
            tts_available: tts.available,
            tts_engine: tts.engine,
            stt_available: stt.available,
            stt_engine: stt.engine,
            stt_listening: stt.listening,
        }
    }
}
