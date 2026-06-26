//! Tauri commands for the Classroom Engine (first slice).
//! Resolves the active LLM backend, pulls curriculum grounding via RAG, and
//! delegates the actual teaching/evaluation to `ai::classroom`.

use crate::ai::{classroom, provider, rag};
use crate::db::DbState;
use rusqlite::OptionalExtension;
use serde::Serialize;
use tauri::State;
use uuid::Uuid;

/// Martha begins a class on a topic: introduction + teaching points + a
/// checking question, grounded in retrieved curriculum.
#[tauri::command]
pub async fn classroom_start_lesson(
    db: State<'_, DbState>,
    subject: String,
    topic: String,
    class_level: String,
) -> Result<classroom::LessonSegment, String> {
    let prov = provider::resolve(&db).await?;

    let context = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        rag::search_knowledge_base(&conn, &topic, &subject, &class_level).unwrap_or_default()
    };

    classroom::start_lesson(&prov, &subject, &topic, &class_level, &context).await
}

/// Plan a full ~30-minute lesson as 8–10 short segments.
#[tauri::command]
pub async fn classroom_plan_lesson(
    db: State<'_, DbState>,
    subject: String,
    topic: String,
    class_level: String,
) -> Result<classroom::LessonPlan, String> {
    let prov = provider::resolve(&db).await?;
    let context = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        rag::search_knowledge_base(&conn, &topic, &subject, &class_level).unwrap_or_default()
    };
    let context: String = context.chars().take(1500).collect();
    classroom::plan_lesson(&prov, &subject, &topic, &class_level, &context).await
}

/// Teach one segment of the planned lesson (whiteboard steps + a question).
#[tauri::command]
pub async fn classroom_teach_segment(
    db: State<'_, DbState>,
    subject: String,
    topic: String,
    class_level: String,
    segment_title: String,
    segment_index: usize,
    total_segments: usize,
) -> Result<classroom::TeachingSegment, String> {
    let prov = provider::resolve(&db).await?;
    let context = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        rag::search_knowledge_base(&conn, &segment_title, &subject, &class_level).unwrap_or_default()
    };
    // Cap the injected context so a big textbook can't bloat the prompt (slow prefill).
    let context: String = context.chars().take(1500).collect();
    classroom::teach_segment(
        &prov, &subject, &topic, &class_level, &segment_title,
        segment_index, total_segments, &context,
    )
    .await
}

// ── Pre-generated ("baked") lessons ──────────────────────────────────────────

#[derive(Serialize)]
pub struct GeneratedLessonMeta {
    pub subject: String,
    pub class_level: String,
    pub topic: String,
    pub title: Option<String>,
    pub segment_count: i64,
    pub created_at: String,
}

/// PRODUCER: bake a whole lesson (plan + all segments) and store it. Slow — meant
/// to run once on capable hardware; the result ships in a pack for instant play.
#[tauri::command]
pub async fn bake_lesson(
    db: State<'_, DbState>,
    subject: String,
    topic: String,
    class_level: String,
) -> Result<classroom::GeneratedLesson, String> {
    let prov = provider::resolve(&db).await?;
    let context = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        rag::search_knowledge_base(&conn, &topic, &subject, &class_level).unwrap_or_default()
    };
    let context: String = context.chars().take(1500).collect();

    // Heavy generation happens here (no DB lock held across the await).
    let lesson = classroom::bake_lesson(&prov, &subject, &topic, &class_level, &context).await?;

    let content = serde_json::to_string(&lesson).map_err(|e| e.to_string())?;
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO generated_lessons (id, subject, class_level, topic, title, content)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(subject, class_level, topic)
         DO UPDATE SET title = ?5, content = ?6, created_at = datetime('now')",
        rusqlite::params![Uuid::new_v4().to_string(), subject, class_level, topic, lesson.title, content],
    )
    .map_err(|e| e.to_string())?;
    Ok(lesson)
}

/// SCHOOL: fetch a pre-generated lesson for instant playback, if one exists.
#[tauri::command]
pub async fn get_generated_lesson(
    db: State<'_, DbState>,
    subject: String,
    topic: String,
    class_level: String,
) -> Result<Option<classroom::GeneratedLesson>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let content: Option<String> = conn
        .query_row(
            "SELECT content FROM generated_lessons WHERE subject = ?1 AND class_level = ?2 AND topic = ?3",
            rusqlite::params![subject, class_level, topic],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    match content {
        Some(c) => Ok(Some(serde_json::from_str(&c).map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// List all baked lessons (for a producer/management view).
#[tauri::command]
pub async fn list_generated_lessons(
    db: State<'_, DbState>,
) -> Result<Vec<GeneratedLessonMeta>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT subject, class_level, topic, title, content, created_at
             FROM generated_lessons ORDER BY subject, class_level, topic",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            let content: String = r.get(4)?;
            let segment_count = content.matches("\"check_question\"").count() as i64;
            Ok(GeneratedLessonMeta {
                subject: r.get(0)?,
                class_level: r.get(1)?,
                topic: r.get(2)?,
                title: r.get(3)?,
                segment_count,
                created_at: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Martha evaluates a student's answer to the checking question.
#[tauri::command]
pub async fn classroom_evaluate_answer(
    db: State<'_, DbState>,
    subject: String,
    topic: String,
    question: String,
    student_answer: String,
) -> Result<classroom::AnswerEvaluation, String> {
    let prov = provider::resolve(&db).await?;
    classroom::evaluate_answer(&prov, &subject, &topic, &question, &student_answer).await
}
