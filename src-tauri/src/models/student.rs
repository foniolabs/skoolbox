use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Student {
    pub id: String,
    pub full_name: String,
    pub class_level: String,
    pub avatar_url: Option<String>,
    pub streak_days: i32,
    pub total_points: i32,
    pub created_at: String,
    /// 'active' | 'suspended'
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentProgress {
    pub id: String,
    pub student_id: String,
    pub topic_id: String,
    pub status: String, // not_started, in_progress, completed
    pub score: f64,
    pub time_spent_seconds: i32,
    pub last_accessed: Option<String>,
    pub mastery_level: String, // needs_attention, working_towards, mastered
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassOverview {
    pub total_students: i32,
    pub average_score: f64,
    pub mastered_count: i32,
    pub working_towards_count: i32,
    pub needs_attention_count: i32,
    pub total_work_assigned: i32,
}
