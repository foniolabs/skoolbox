use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subject {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub class_level: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Topic {
    pub id: String,
    pub subject_id: String,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub is_locked: bool,
    pub is_taught: bool,
    pub estimated_minutes: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lesson {
    pub id: String,
    pub topic_id: String,
    pub title: String,
    pub content_markdown: Option<String>,
    pub content_summary: Option<String>,
    pub sort_order: i32,
}
