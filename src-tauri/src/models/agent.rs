use serde::{Deserialize, Serialize};

/// The student's persistent learning profile, built over many interactions.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LearningProfile {
    pub id: String,
    pub student_id: String,
    pub preferred_explanation_type: String,
    pub strongest_subjects: String,     // JSON array
    pub weakest_subjects: String,       // JSON array
    pub strongest_topics: String,       // JSON array
    pub weakest_topics: String,         // JSON array
    pub overall_mastery_level: String,  // beginner|developing|proficient|advanced
    pub confidence_level: String,       // low|medium|high
    pub frustration_indicators: i64,
    pub total_ai_conversations: i64,
    pub total_ai_messages: i64,
    pub topics_discussed: String,       // JSON array of topic names
    pub last_conversation_summary: Option<String>,
    pub updated_at: String,
}

/// A compressed summary of a past tutoring conversation.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationSummary {
    pub id: String,
    pub student_id: String,
    pub subject: String,
    pub topic: Option<String>,
    pub summary: String,
    pub key_insights: Option<String>,
    pub messages_count: Option<i64>,
    pub session_date: String,
}

/// A recurring mistake pattern for a student on a topic.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StudentMistake {
    pub id: String,
    pub student_id: String,
    pub topic_id: String,
    pub mistake_type: String,
    pub mistake_description: String,
    pub occurrence_count: i64,
    pub last_occurred: String,
    pub is_resolved: bool,
}

/// A high-quality AI explanation saved for reuse.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GoldenExplanation {
    pub id: String,
    pub topic_id: String,
    pub student_question: String,
    pub ai_response: String,
    pub feedback_score: f64,
    pub times_reused: i64,
    pub created_at: String,
}


/// A single message in a student's chat history.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatHistoryMessage {
    pub id: String,
    pub student_id: String,
    pub role: String,           // user|assistant
    pub content: String,
    pub subject: Option<String>,
    pub topic: Option<String>,
    pub conversation_id: String,
    pub created_at: String,
}

/// Response from the AI agent chat command.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentResponse {
    pub message: String,
    pub conversation_id: String,
    pub message_id: String,
}

/// Topic health data for teacher dashboard.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TopicHealth {
    pub topic_id: String,
    pub topic_name: String,
    pub subject_name: String,
    pub total_feedback: i64,
    pub negative_feedback: i64,
    pub avg_quiz_score: Option<f64>,
}

/// Result of running the feedback batch processor.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FeedbackProcessResult {
    pub golden_explanations_added: i64,
    pub problem_topics_flagged: i64,
    pub summaries_generated: i64,
}
