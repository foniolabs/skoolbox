use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Question {
    pub id: String,
    pub topic_id: String,
    pub question_text: String,
    pub question_type: String, // mcq, short_answer, true_false
    pub options: Option<String>, // JSON array for MCQ
    pub correct_answer: String,
    pub explanation: Option<String>,
    pub difficulty: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizAttempt {
    pub id: String,
    pub student_id: String,
    pub subject_id: Option<String>,
    pub topic_id: Option<String>,
    pub quiz_type: String, // practice, assessment, ai_generated
    pub total_questions: i32,
    pub correct_answers: i32,
    pub score: f64,
    pub time_taken_seconds: Option<i32>,
    pub questions_data: Option<String>, // JSON
    pub created_at: String,
}
