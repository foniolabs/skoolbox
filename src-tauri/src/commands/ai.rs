use crate::ai::claude_api;
use crate::ai::prompts;
use crate::ai::rag;
use crate::db::DbState;
use tauri::State;

/// Resolve the API key: check DB settings first, then .env file, then env var.
fn resolve_api_key(db: &DbState) -> Result<String, String> {
    // 1. Try from DB settings
    if let Ok(conn) = db.db.lock() {
        let mut stmt = conn
            .prepare("SELECT value FROM settings WHERE key = 'claude_api_key'")
            .ok();
        if let Some(ref mut s) = stmt {
            if let Ok(val) = s.query_row([], |row| row.get::<_, String>(0)) {
                if !val.is_empty() {
                    return Ok(val);
                }
            }
        }
    }

    // 2. Try from .env file (loaded at startup) or environment variable
    if let Ok(key) = std::env::var("API_KEY") {
        if !key.is_empty() {
            return Ok(key);
        }
    }

    // 3. Also try ANTHROPIC_API_KEY
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.is_empty() {
            return Ok(key);
        }
    }

    Err("No API key found. Please set your Claude API key in Settings or in the .env file.".to_string())
}

/// Main AI teaching command. Teacher types a command, AI generates structured lesson JSON.
#[tauri::command]
pub async fn ask_ai_tutor(
    db: State<'_, DbState>,
    prompt: String,
    subject: String,
    class_level: String,
    mode: String,
) -> Result<String, String> {
    let api_key = resolve_api_key(&db)?;

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

    // 3. Call Claude API
    let system = prompts::teaching_assistant_prompt();
    let response = claude_api::call_claude(&api_key, system, &user_message, 4000).await?;

    // 4. Extract JSON from response (Claude might wrap it in markdown code blocks)
    let json_str = extract_json(&response);

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
    let api_key = resolve_api_key(&db)?;

    let user_message = format!(
        r#"Generate {} quiz questions for {} students.
Subject: {}
Topic: {}
Difficulty: {}
Return ONLY valid JSON."#,
        num_questions, class_level, subject, topic, difficulty
    );

    let system = prompts::quiz_generator_prompt();
    let response = claude_api::call_claude(&api_key, system, &user_message, 3000).await?;

    Ok(extract_json(&response))
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
    let api_key = resolve_api_key(&db)?;

    let system = prompts::student_tutor_prompt(&subject, &topic, &class_level);
    let response = claude_api::call_claude_chat(&api_key, &system, messages, 2000).await?;
    Ok(response)
}

/// Check if we can reach the internet (for online/offline detection).
#[tauri::command]
pub async fn check_connectivity() -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    match client.get("https://api.anthropic.com").send().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Extract JSON from a response that might be wrapped in markdown code blocks.
fn extract_json(text: &str) -> String {
    let trimmed = text.trim();

    // Try to extract from ```json ... ``` blocks
    if let Some(start) = trimmed.find("```json") {
        let after_marker = &trimmed[start + 7..];
        if let Some(end) = after_marker.find("```") {
            return after_marker[..end].trim().to_string();
        }
    }

    // Try to extract from ``` ... ``` blocks
    if let Some(start) = trimmed.find("```") {
        let after_marker = &trimmed[start + 3..];
        if let Some(end) = after_marker.find("```") {
            return after_marker[..end].trim().to_string();
        }
    }

    // If it starts with { or [, it's already JSON
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        return trimmed.to_string();
    }

    trimmed.to_string()
}
