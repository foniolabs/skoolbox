use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Video {
    pub id: String,
    pub title: String,
    pub youtube_id: Option<String>,
    pub subject: String,
    pub topic: Option<String>,
    pub class_level: Option<String>,
    pub duration_seconds: Option<i32>,
    pub description: Option<String>,
    pub source: String,
    pub created_at: String,
}
