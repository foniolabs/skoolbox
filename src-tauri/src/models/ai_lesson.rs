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
