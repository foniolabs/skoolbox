use crate::ai::ollama;
use crate::ai::prompts;
use crate::ai::provider;
use crate::ai::rag;
use crate::db::DbState;
use tauri::State;

/// Main AI teaching command. Teacher types a command, AI generates structured lesson JSON.
#[tauri::command]
pub async fn ask_ai_tutor(
    db: State<'_, DbState>,
    prompt: String,
    subject: String,
    class_level: String,
    mode: String,
) -> Result<String, String> {
    let prov = provider::resolve(&db).await?;

    // 1. Search knowledge base for relevant context (RAG)
    let context = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        rag::search_knowledge_base(&conn, &prompt, &subject, &class_level).unwrap_or_default()
    };

    // 2. Build user message with context
    let preferred_mode = if mode == "auto" {
        "Choose the best mode for this topic".to_string()
    } else {
        format!("Use \"{}\" mode", mode)
    };

    // Check if there are term plan notes for this topic
    let plan_notes = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        let search = format!("%{}%", &prompt[..prompt.len().min(40)]);
        conn.query_row(
            "SELECT tpt.lesson_notes FROM term_plan_topics tpt
             JOIN term_plans tp ON tp.id = tpt.plan_id
             WHERE tpt.lesson_notes IS NOT NULL
             AND tpt.topic_name LIKE ?1
             AND tp.subject_name LIKE ?2
             AND tp.class_level = ?3
             AND tp.is_active = 1
             ORDER BY tpt.created_at DESC
             LIMIT 1",
            rusqlite::params![search, format!("%{}%", subject), class_level],
            |row| row.get::<_, String>(0),
        )
        .ok()
    };

    let notes_section = if let Some(notes) = plan_notes {
        format!("\n\nTeacher's lesson notes for this topic:\n---\n{}\n---\nUse these notes as the basis for your lesson.", notes)
    } else {
        String::new()
    };

    let user_message = format!(
        r#"Teacher command: "{}"
Subject: {}
Class: {}
{}

{}{}

Generate the lesson as structured JSON."#,
        prompt, subject, class_level, preferred_mode, context, notes_section
    );

    // 3. Generate the lesson as validated JSON (constrained + retried for small models)
    let system = prompts::teaching_assistant_prompt();
    let json_str = provider::generate_json(&prov, system, &user_message, 4000).await?;

    Ok(json_str)
}

/// Generate quiz questions using AI.
#[tauri::command]
pub async fn generate_quiz_ai(
    db: State<'_, DbState>,
    subject: String,
    topic: String,
    class_level: String,
    difficulty: String,
    num_questions: i32,
) -> Result<String, String> {
    let prov = provider::resolve(&db).await?;

    let user_message = format!(
        r#"Generate {} quiz questions for {} students.
Subject: {}
Topic: {}
Difficulty: {}
Return ONLY valid JSON."#,
        num_questions, class_level, subject, topic, difficulty
    );

    let system = prompts::quiz_generator_prompt();
    provider::generate_json(&prov, system, &user_message, 3000).await
}

/// Student-facing AI tutor with multi-turn conversation.
#[tauri::command]
pub async fn ask_student_tutor(
    db: State<'_, DbState>,
    messages: Vec<(String, String)>, // (role, content) pairs
    subject: String,
    topic: String,
    class_level: String,
) -> Result<String, String> {
    let prov = provider::resolve(&db).await?;

    let system = prompts::student_tutor_prompt(&subject, &topic, &class_level);
    let response = provider::chat(&prov, &system, messages, 2000).await?;
    Ok(response)
}

/// Check whether the active AI backend is reachable (for online/offline UI state).
///
/// In the default offline configuration this pings the local Ollama server; it
/// no longer requires internet access.
#[tauri::command]
pub async fn check_connectivity() -> Result<bool, String> {
    Ok(ollama::is_available().await)
}
