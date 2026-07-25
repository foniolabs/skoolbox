use crate::ai::{martha, provider, rag};
use crate::db::DbState;
use crate::models::agent::*;
use tauri::State;
use uuid::Uuid;

// ── Internal helpers ──────────────────────────────────────────────────────────

/// Ensure a learning profile row exists for this student.
fn ensure_learning_profile(db: &DbState, student_id: &str) -> Result<(), String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT OR IGNORE INTO student_learning_profile
         (id, student_id) VALUES (?1, ?2)",
        rusqlite::params![id, student_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Save a single chat message to chat_history.
#[allow(clippy::too_many_arguments)] // mirrors the JS invoke() args
fn save_chat_message(
    db: &DbState,
    student_id: &str,
    conversation_id: &str,
    message_id: &str,
    role: &str,
    content: &str,
    subject: Option<&str>,
    topic: Option<&str>,
) -> Result<(), String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO chat_history (id, student_id, role, content, subject, topic, conversation_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            message_id,
            student_id,
            role,
            content,
            subject,
            topic,
            conversation_id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Fetch the last N messages in a conversation (for multi-turn history).
fn get_conversation_messages(
    db: &DbState,
    student_id: &str,
    conversation_id: &str,
    limit: i64,
) -> Result<Vec<ChatHistoryMessage>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, student_id, role, content, subject, topic, conversation_id, created_at
             FROM chat_history
             WHERE student_id = ?1 AND conversation_id = ?2
             ORDER BY created_at ASC
             LIMIT ?3",
        )
        .map_err(|e| e.to_string())?;

    let messages = stmt
        .query_map(rusqlite::params![student_id, conversation_id, limit], |row| {
            Ok(ChatHistoryMessage {
                id: row.get(0)?,
                student_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                subject: row.get(4)?,
                topic: row.get(5)?,
                conversation_id: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(messages)
}

/// Increment conversation/message stats on the learning profile.
fn increment_profile_stats(db: &DbState, student_id: &str, is_new_conversation: bool) {
    if let Ok(conn) = db.db.lock() {
        if is_new_conversation {
            let _ = conn.execute(
                "UPDATE student_learning_profile
                 SET total_ai_conversations = total_ai_conversations + 1,
                     total_ai_messages = total_ai_messages + 2,
                     updated_at = datetime('now')
                 WHERE student_id = ?1",
                rusqlite::params![student_id],
            );
        } else {
            let _ = conn.execute(
                "UPDATE student_learning_profile
                 SET total_ai_messages = total_ai_messages + 2,
                     updated_at = datetime('now')
                 WHERE student_id = ?1",
                rusqlite::params![student_id],
            );
        }
    }
}

// ── Phase 4: Main agent chat command ─────────────────────────────────────────

/// Main AI agent chat command. Replaces ask_student_tutor for the student chat.
///
/// Implements all 4 layers:
/// - Layer 1: Master system prompt (Martha's identity) — cached
/// - Layer 2: Curriculum context (RAG with teaching notes + golden examples)
/// - Layer 3: Student memory (profile, history, mistakes)
/// - Layer 4: Conversation history (last 10 messages)
#[tauri::command]
pub async fn ai_agent_chat(
    db: State<'_, DbState>,
    student_id: String,
    message: String,
    subject: String,
    topic: Option<String>,
    class_level: String,
    conversation_id: String,
) -> Result<AgentResponse, String> {
    let prov = provider::resolve(&db).await?;

    // 1. Get student name
    let student_name = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT full_name FROM students WHERE id = ?1",
            rusqlite::params![&student_id],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "Student".to_string())
    };

    // 2. Ensure learning profile exists
    ensure_learning_profile(&db, &student_id)?;

    // 3. Get conversation history (last 10 messages)
    let history = get_conversation_messages(&db, &student_id, &conversation_id, 10)?;
    let is_new_conversation = history.is_empty();

    // 4. Build curriculum context (enhanced RAG)
    let topic_ref = topic.as_deref().unwrap_or(&message);
    let curriculum_context = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        rag::search_knowledge_base_enhanced(
            &conn,
            topic_ref,
            &subject,
            &class_level,
            Some(&student_id),
        )
        .unwrap_or_default()
    };

    // 5. Build student context string
    let student_context = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        rag::build_student_context(&conn, &student_id, &student_name, &class_level)
    };

    // 6. Assemble the dynamic context block (Layers 2 + 3)
    let topic_display = topic.as_deref().unwrap_or("this topic");
    let mut context_block = format!(
        "## Current Session\nSubject: {}\nTopic: {}\nClass Level: {}",
        subject, topic_display, class_level
    );
    if !curriculum_context.is_empty() {
        context_block.push_str("\n\n");
        context_block.push_str(&curriculum_context);
    }
    if !student_context.is_empty() {
        context_block.push_str("\n\n");
        context_block.push_str(&student_context);
    }

    // 7. Assemble message history for the API call
    let mut messages: Vec<(String, String)> = history
        .iter()
        .map(|m| (m.role.clone(), m.content.clone()))
        .collect();
    messages.push(("user".to_string(), message.clone()));

    // 8. One Martha tutoring turn on the active backend (Ollama offline by default).
    let response = martha::tutor_reply(&prov, &context_block, messages, 2000).await?;

    // 9. Save messages to chat_history
    let user_msg_id = Uuid::new_v4().to_string();
    let ai_msg_id = Uuid::new_v4().to_string();
    save_chat_message(
        &db,
        &student_id,
        &conversation_id,
        &user_msg_id,
        "user",
        &message,
        Some(&subject),
        topic.as_deref(),
    )?;
    save_chat_message(
        &db,
        &student_id,
        &conversation_id,
        &ai_msg_id,
        "assistant",
        &response,
        Some(&subject),
        topic.as_deref(),
    )?;

    // 10. Update profile stats (fire-and-forget, don't fail the call)
    increment_profile_stats(&db, &student_id, is_new_conversation);

    Ok(AgentResponse {
        message: response,
        conversation_id,
        message_id: ai_msg_id,
    })
}

// ── Phase 5: Feedback system ──────────────────────────────────────────────────

/// Save thumbs-up/down feedback on an AI response.
#[tauri::command]
#[allow(clippy::too_many_arguments)] // mirrors the JS invoke() args
pub async fn submit_ai_feedback(
    db: State<'_, DbState>,
    student_id: String,
    message_id: String,
    conversation_id: String,
    feedback_type: String, // "thumbs_up" | "thumbs_down"
    feedback_detail: Option<String>,
    ai_response_text: String,
    student_question: String,
    topic_id: Option<String>,
    subject: Option<String>,
) -> Result<bool, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO ai_feedback
         (id, student_id, conversation_id, message_id, feedback_type, feedback_detail,
          topic_id, subject, ai_response_text, student_question)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        rusqlite::params![
            id,
            student_id,
            conversation_id,
            message_id,
            feedback_type,
            feedback_detail,
            topic_id,
            subject,
            ai_response_text,
            student_question
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

/// Process feedback batch: extract golden explanations, flag problem topics.
/// Run this periodically (daily) or manually from the teacher dashboard.
#[tauri::command]
pub async fn process_feedback_batch(
    db: State<'_, DbState>,
) -> Result<FeedbackProcessResult, String> {
    let mut golden_added: i64 = 0;
    let mut problems_flagged: i64 = 0;

    {
        let conn = db.db.lock().map_err(|e| e.to_string())?;

        // 1. Extract golden explanations: thumbs_up feedback with topic_id
        let mut stmt = conn
            .prepare(
                "SELECT topic_id, student_question, ai_response_text, quiz_score_after
                 FROM ai_feedback
                 WHERE feedback_type = 'thumbs_up'
                 AND topic_id IS NOT NULL
                 AND id NOT IN (SELECT DISTINCT student_question FROM golden_explanations)
                 LIMIT 50",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let topic_id: String = row.get(0)?;
                let question: String = row.get(1)?;
                let response: String = row.get(2)?;
                let quiz_score: Option<f64> = row.get(3)?;
                Ok((topic_id, question, response, quiz_score))
            })
            .map_err(|e| e.to_string())?;

        for row in rows.flatten() {
            let (topic_id, question, response, quiz_score) = row;
            let score = quiz_score.unwrap_or(75.0); // default good score if no quiz
            let id = Uuid::new_v4().to_string();
            let _ = conn.execute(
                "INSERT OR IGNORE INTO golden_explanations
                 (id, topic_id, student_question, ai_response, feedback_score)
                 VALUES (?1,?2,?3,?4,?5)",
                rusqlite::params![id, topic_id, question, response, score],
            );
            golden_added += 1;
        }

        // 2. Flag problem topics: topics with >40% negative feedback
        let mut problem_stmt = conn
            .prepare(
                "SELECT topic_id,
                        COUNT(*) as total,
                        SUM(CASE WHEN feedback_type = 'thumbs_down' THEN 1 ELSE 0 END) as negative
                 FROM ai_feedback
                 WHERE topic_id IS NOT NULL
                 GROUP BY topic_id
                 HAVING negative > 2 AND (CAST(negative AS REAL) / total) > 0.4",
            )
            .map_err(|e| e.to_string())?;

        let problem_rows = problem_stmt
            .query_map([], |row| {
                let topic_id: String = row.get(0)?;
                Ok(topic_id)
            })
            .map_err(|e| e.to_string())?;

        for topic in problem_rows.flatten() {
            // Update difficulty rating on teaching_notes if it exists
            let _ = conn.execute(
                "UPDATE teaching_notes SET difficulty_rating = MIN(5.0, difficulty_rating + 0.5)
                 WHERE topic_id = ?1",
                rusqlite::params![topic],
            );
            problems_flagged += 1;
        }
    }

    Ok(FeedbackProcessResult {
        golden_explanations_added: golden_added,
        problem_topics_flagged: problems_flagged,
        summaries_generated: 0, // summaries are generated separately
    })
}

// ── Phase 6: Conversation summaries + student profile ────────────────────────

/// Generate and save a conversation summary after a session ends.
/// Call this when the student leaves the chat page.
#[tauri::command]
pub async fn generate_conversation_summary(
    db: State<'_, DbState>,
    student_id: String,
    conversation_id: String,
    subject: String,
    topic: Option<String>,
) -> Result<String, String> {
    let prov = provider::resolve(&db).await?;

    // Get all messages from this conversation
    let history = get_conversation_messages(&db, &student_id, &conversation_id, 50)?;
    if history.len() < 2 {
        return Ok("Session too short to summarize.".to_string());
    }

    // Build conversation text for summarization
    let conversation_text: String = history
        .iter()
        .map(|m| {
            let role = if m.role == "user" { "Student" } else { "Martha (AI)" };
            format!("{}: {}", role, &m.content[..m.content.len().min(500)])
        })
        .collect::<Vec<_>>()
        .join("\n\n");

    // Summarize via the active LLM backend (Ollama offline by default).
    let summary = provider::summarize(&prov, &conversation_text).await?;

    // Save to conversation_summaries
    {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO conversation_summaries
             (id, student_id, subject, topic, summary, messages_count)
             VALUES (?1,?2,?3,?4,?5,?6)",
            rusqlite::params![
                id,
                student_id,
                subject,
                topic,
                summary,
                history.len() as i64
            ],
        )
        .map_err(|e| e.to_string())?;

        // Also update last_conversation_summary on the profile
        conn.execute(
            "UPDATE student_learning_profile
             SET last_conversation_summary = ?1, updated_at = datetime('now')
             WHERE student_id = ?2",
            rusqlite::params![summary, student_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(summary)
}

/// Get the student's learning profile.
#[tauri::command]
pub async fn get_student_learning_profile(
    db: State<'_, DbState>,
    student_id: String,
) -> Result<LearningProfile, String> {
    // Ensure profile exists first
    ensure_learning_profile(&db, &student_id)?;

    let conn = db.db.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, student_id, preferred_explanation_type,
                strongest_subjects, weakest_subjects, strongest_topics, weakest_topics,
                overall_mastery_level, confidence_level, frustration_indicators,
                total_ai_conversations, total_ai_messages, topics_discussed,
                last_conversation_summary, updated_at
         FROM student_learning_profile WHERE student_id = ?1",
        rusqlite::params![student_id],
        |row| {
            Ok(LearningProfile {
                id: row.get(0)?,
                student_id: row.get(1)?,
                preferred_explanation_type: row.get(2)?,
                strongest_subjects: row.get(3)?,
                weakest_subjects: row.get(4)?,
                strongest_topics: row.get(5)?,
                weakest_topics: row.get(6)?,
                overall_mastery_level: row.get(7)?,
                confidence_level: row.get(8)?,
                frustration_indicators: row.get(9)?,
                total_ai_conversations: row.get(10)?,
                total_ai_messages: row.get(11)?,
                topics_discussed: row.get(12)?,
                last_conversation_summary: row.get(13)?,
                updated_at: row.get(14)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Get conversation summaries for a student.
#[tauri::command]
pub async fn get_conversation_summaries(
    db: State<'_, DbState>,
    student_id: String,
    limit: i64,
) -> Result<Vec<ConversationSummary>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, student_id, subject, topic, summary, key_insights, messages_count, session_date
             FROM conversation_summaries
             WHERE student_id = ?1
             ORDER BY session_date DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![student_id, limit], |row| {
            Ok(ConversationSummary {
                id: row.get(0)?,
                student_id: row.get(1)?,
                subject: row.get(2)?,
                topic: row.get(3)?,
                summary: row.get(4)?,
                key_insights: row.get(5)?,
                messages_count: row.get(6)?,
                session_date: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

/// Get chat history for a conversation.
#[tauri::command]
pub async fn get_chat_history(
    db: State<'_, DbState>,
    student_id: String,
    conversation_id: String,
    limit: i64,
) -> Result<Vec<ChatHistoryMessage>, String> {
    get_conversation_messages(&db, &student_id, &conversation_id, limit)
}

/// Get the student's active (unresolved) mistake patterns.
#[tauri::command]
pub async fn get_student_mistakes(
    db: State<'_, DbState>,
    student_id: String,
) -> Result<Vec<StudentMistake>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, student_id, topic_id, mistake_type, mistake_description,
                    occurrence_count, last_occurred, is_resolved
             FROM student_mistakes
             WHERE student_id = ?1 AND is_resolved = 0
             ORDER BY occurrence_count DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![student_id], |row| {
            Ok(StudentMistake {
                id: row.get(0)?,
                student_id: row.get(1)?,
                topic_id: row.get(2)?,
                mistake_type: row.get(3)?,
                mistake_description: row.get(4)?,
                occurrence_count: row.get(5)?,
                last_occurred: row.get(6)?,
                is_resolved: row.get::<_, i64>(7)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

/// Record a student mistake (called after a quiz or when AI detects repeated confusion).
#[tauri::command]
pub async fn record_student_mistake(
    db: State<'_, DbState>,
    student_id: String,
    topic_id: String,
    mistake_type: String,
    mistake_description: String,
) -> Result<bool, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    // Check if this mistake already exists (upsert)
    let existing: Option<(String, i64)> = conn
        .query_row(
            "SELECT id, occurrence_count FROM student_mistakes
             WHERE student_id = ?1 AND topic_id = ?2 AND mistake_type = ?3",
            rusqlite::params![student_id, topic_id, mistake_type],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    if let Some((id, count)) = existing {
        conn.execute(
            "UPDATE student_mistakes
             SET occurrence_count = ?1, last_occurred = datetime('now'), is_resolved = 0
             WHERE id = ?2",
            rusqlite::params![count + 1, id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO student_mistakes
             (id, student_id, topic_id, mistake_type, mistake_description)
             VALUES (?1,?2,?3,?4,?5)",
            rusqlite::params![id, student_id, topic_id, mistake_type, mistake_description],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(true)
}

/// Get golden explanations for a topic.
#[tauri::command]
pub async fn get_golden_explanations(
    db: State<'_, DbState>,
    topic_id: String,
    limit: i64,
) -> Result<Vec<GoldenExplanation>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, topic_id, student_question, ai_response, feedback_score, times_reused, created_at
             FROM golden_explanations
             WHERE topic_id = ?1
             ORDER BY feedback_score DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![topic_id, limit], |row| {
            Ok(GoldenExplanation {
                id: row.get(0)?,
                topic_id: row.get(1)?,
                student_question: row.get(2)?,
                ai_response: row.get(3)?,
                feedback_score: row.get(4)?,
                times_reused: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

/// Get topic health data — shows which topics students struggle with most.
/// Used on the teacher's monitoring dashboard.
#[tauri::command]
pub async fn get_topic_health(
    db: State<'_, DbState>,
    subject: Option<String>,
) -> Result<Vec<TopicHealth>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    let query = if subject.is_some() {
        "SELECT t.id, t.name, s.name as subject_name,
                COUNT(af.id) as total_feedback,
                SUM(CASE WHEN af.feedback_type = 'thumbs_down' THEN 1 ELSE 0 END) as negative_feedback,
                AVG(af.quiz_score_after) as avg_quiz_score
         FROM topics t
         JOIN subjects s ON s.id = t.subject_id
         LEFT JOIN ai_feedback af ON af.topic_id = t.id
         WHERE s.name = ?1
         GROUP BY t.id
         ORDER BY negative_feedback DESC
         LIMIT 20"
    } else {
        "SELECT t.id, t.name, s.name as subject_name,
                COUNT(af.id) as total_feedback,
                SUM(CASE WHEN af.feedback_type = 'thumbs_down' THEN 1 ELSE 0 END) as negative_feedback,
                AVG(af.quiz_score_after) as avg_quiz_score
         FROM topics t
         JOIN subjects s ON s.id = t.subject_id
         LEFT JOIN ai_feedback af ON af.topic_id = t.id
         GROUP BY t.id
         ORDER BY negative_feedback DESC
         LIMIT 20"
    };

    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;

    let subject_param = subject.as_deref().unwrap_or("");
    let rows: Vec<TopicHealth> = if !subject_param.is_empty() {
        stmt.query_map(rusqlite::params![subject_param], |row| {
            Ok(TopicHealth {
                topic_id: row.get(0)?,
                topic_name: row.get(1)?,
                subject_name: row.get(2)?,
                total_feedback: row.get::<_, Option<i64>>(3)?.unwrap_or(0),
                negative_feedback: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
                avg_quiz_score: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    } else {
        stmt.query_map([], |row| {
            Ok(TopicHealth {
                topic_id: row.get(0)?,
                topic_name: row.get(1)?,
                subject_name: row.get(2)?,
                total_feedback: row.get::<_, Option<i64>>(3)?.unwrap_or(0),
                negative_feedback: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
                avg_quiz_score: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    };

    Ok(rows)
}

/// Update the student's learning profile (confidence, mastery, preferred style).
#[tauri::command]
pub async fn update_student_learning_profile(
    db: State<'_, DbState>,
    student_id: String,
    overall_mastery_level: Option<String>,
    confidence_level: Option<String>,
    preferred_explanation_type: Option<String>,
) -> Result<bool, String> {
    ensure_learning_profile(&db, &student_id)?;
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    if let Some(mastery) = overall_mastery_level {
        conn.execute(
            "UPDATE student_learning_profile SET overall_mastery_level = ?1, updated_at = datetime('now') WHERE student_id = ?2",
            rusqlite::params![mastery, student_id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(confidence) = confidence_level {
        conn.execute(
            "UPDATE student_learning_profile SET confidence_level = ?1, updated_at = datetime('now') WHERE student_id = ?2",
            rusqlite::params![confidence, student_id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(style) = preferred_explanation_type {
        conn.execute(
            "UPDATE student_learning_profile SET preferred_explanation_type = ?1, updated_at = datetime('now') WHERE student_id = ?2",
            rusqlite::params![style, student_id],
        ).map_err(|e| e.to_string())?;
    }
    Ok(true)
}
