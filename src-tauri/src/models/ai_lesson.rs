use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AILesson {
    pub id: String,
    pub teacher_command: String,
    pub subject: Option<String>,
    pub class_level: Option<String>,
    pub mode: String, // whiteboard, video, animation, slideshow, narrated
    pub lesson_data: String, // full JSON of generated lesson
    pub duration_seconds: Option<i32>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncQueueItem {
    pub id: String,
    pub action: String,
    pub data: String,
    pub is_synced: bool,
    pub retry_count: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSetting {
    pub key: String,
    pub value: String,
}
