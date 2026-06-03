use serde::{Deserialize, Serialize};

/// A term plan ties a subject + class + term together.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TermPlan {
    pub id: String,
    pub subject_id: String,
    pub subject_name: String,
    pub class_level: String,
    pub term: i64,               // 1, 2, or 3
    pub academic_year: String,   // e.g. "2024/2025"
    pub title: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub topic_count: i64,        // computed: how many topics in this plan
}

/// A single topic/week inside a term plan.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TermPlanTopic {
    pub id: String,
    pub plan_id: String,
    pub week_number: i64,
    pub topic_name: String,
    pub topic_id: Option<String>,    // links to topics table if matched
    pub lesson_notes: Option<String>,
    pub objectives: Option<String>,  // JSON array
    pub activities: Option<String>,  // JSON array
    pub duration_minutes: i64,
    pub is_ai_generated: bool,
    pub is_taught: bool,
    pub taught_at: Option<String>,
    pub created_at: String,
}
