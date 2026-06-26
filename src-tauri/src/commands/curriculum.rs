use crate::ai::{provider, rag};
use crate::db::DbState;
use crate::models::curriculum::*;
use tauri::State;
use uuid::Uuid;

// ── Term Plan CRUD ────────────────────────────────────────────────────────────

/// Create a new term plan for a subject + class + term.
#[tauri::command]
pub fn create_term_plan(
    db: State<DbState>,
    subject_id: String,
    subject_name: String,
    class_level: String,
    term: i64,
    academic_year: String,
    title: Option<String>,
) -> Result<TermPlan, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    // Deactivate any existing active plan for this subject+class+term
    let _ = conn.execute(
        "UPDATE term_plans SET is_active = 0
         WHERE subject_id = ?1 AND class_level = ?2 AND term = ?3",
        rusqlite::params![subject_id, class_level, term],
    );

    let auto_title = title.clone().unwrap_or_else(|| {
        format!("{} — Term {} ({})", subject_name, term, academic_year)
    });

    conn.execute(
        "INSERT INTO term_plans (id, subject_id, subject_name, class_level, term, academic_year, title, is_active)
         VALUES (?1,?2,?3,?4,?5,?6,?7,1)",
        rusqlite::params![id, subject_id, subject_name, class_level, term, academic_year, auto_title],
    )
    .map_err(|e| e.to_string())?;

    Ok(TermPlan {
        id,
        subject_id,
        subject_name,
        class_level,
        term,
        academic_year,
        title: Some(auto_title),
        is_active: true,
        created_at: chrono::Utc::now().to_rfc3339(),
        topic_count: 0,
    })
}

/// Get all term plans, optionally filtered by subject and/or class level.
#[tauri::command]
pub fn get_term_plans(
    db: State<DbState>,
    subject_id: Option<String>,
    class_level: Option<String>,
) -> Result<Vec<TermPlan>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    let sql = "
        SELECT tp.id, tp.subject_id, tp.subject_name, tp.class_level,
               tp.term, tp.academic_year, tp.title, tp.is_active, tp.created_at,
               COUNT(tpt.id) as topic_count
        FROM term_plans tp
        LEFT JOIN term_plan_topics tpt ON tpt.plan_id = tp.id
        WHERE (?1 IS NULL OR tp.subject_id = ?1)
          AND (?2 IS NULL OR tp.class_level = ?2)
        GROUP BY tp.id
        ORDER BY tp.created_at DESC
    ";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            rusqlite::params![subject_id, class_level],
            |row| {
                Ok(TermPlan {
                    id: row.get(0)?,
                    subject_id: row.get(1)?,
                    subject_name: row.get(2)?,
                    class_level: row.get(3)?,
                    term: row.get(4)?,
                    academic_year: row.get(5)?,
                    title: row.get(6)?,
                    is_active: row.get::<_, i64>(7)? != 0,
                    created_at: row.get(8)?,
                    topic_count: row.get(9)?,
                })
            },
        )
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

/// Get the currently active term plan for a subject + class + term.
#[tauri::command]
pub fn get_active_term_plan(
    db: State<DbState>,
    subject_id: String,
    class_level: String,
    term: i64,
) -> Result<Option<TermPlan>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT tp.id, tp.subject_id, tp.subject_name, tp.class_level,
                tp.term, tp.academic_year, tp.title, tp.is_active, tp.created_at,
                COUNT(tpt.id) as topic_count
         FROM term_plans tp
         LEFT JOIN term_plan_topics tpt ON tpt.plan_id = tp.id
         WHERE tp.subject_id = ?1 AND tp.class_level = ?2 AND tp.term = ?3 AND tp.is_active = 1
         GROUP BY tp.id",
        rusqlite::params![subject_id, class_level, term],
        |row| {
            Ok(TermPlan {
                id: row.get(0)?,
                subject_id: row.get(1)?,
                subject_name: row.get(2)?,
                class_level: row.get(3)?,
                term: row.get(4)?,
                academic_year: row.get(5)?,
                title: row.get(6)?,
                is_active: row.get::<_, i64>(7)? != 0,
                created_at: row.get(8)?,
                topic_count: row.get(9)?,
            })
        },
    );

    match result {
        Ok(plan) => Ok(Some(plan)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Delete a term plan and all its topics.
#[tauri::command]
pub fn delete_term_plan(db: State<DbState>, plan_id: String) -> Result<bool, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM term_plan_topics WHERE plan_id = ?1", rusqlite::params![plan_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM term_plans WHERE id = ?1", rusqlite::params![plan_id])
        .map_err(|e| e.to_string())?;
    Ok(true)
}

// ── Term Plan Topics CRUD ─────────────────────────────────────────────────────

/// Get all topics in a plan, ordered by week.
#[tauri::command]
pub fn get_plan_topics(
    db: State<DbState>,
    plan_id: String,
) -> Result<Vec<TermPlanTopic>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, plan_id, week_number, topic_name, topic_id,
                    lesson_notes, objectives, activities, duration_minutes,
                    is_ai_generated, is_taught, taught_at, created_at
             FROM term_plan_topics
             WHERE plan_id = ?1
             ORDER BY week_number ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![plan_id], |row| {
            Ok(TermPlanTopic {
                id: row.get(0)?,
                plan_id: row.get(1)?,
                week_number: row.get(2)?,
                topic_name: row.get(3)?,
                topic_id: row.get(4)?,
                lesson_notes: row.get(5)?,
                objectives: row.get(6)?,
                activities: row.get(7)?,
                duration_minutes: row.get(8)?,
                is_ai_generated: row.get::<_, i64>(9)? != 0,
                is_taught: row.get::<_, i64>(10)? != 0,
                taught_at: row.get(11)?,
                created_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

/// Add a topic (week) to a plan.
#[tauri::command]
pub fn add_plan_topic(
    db: State<DbState>,
    plan_id: String,
    week_number: i64,
    topic_name: String,
    topic_id: Option<String>,
    duration_minutes: Option<i64>,
) -> Result<TermPlanTopic, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let duration = duration_minutes.unwrap_or(40);

    conn.execute(
        "INSERT INTO term_plan_topics (id, plan_id, week_number, topic_name, topic_id, duration_minutes)
         VALUES (?1,?2,?3,?4,?5,?6)",
        rusqlite::params![id, plan_id, week_number, topic_name, topic_id, duration],
    )
    .map_err(|e| e.to_string())?;

    Ok(TermPlanTopic {
        id,
        plan_id,
        week_number,
        topic_name,
        topic_id,
        lesson_notes: None,
        objectives: None,
        activities: None,
        duration_minutes: duration,
        is_ai_generated: false,
        is_taught: false,
        taught_at: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Update a plan topic's notes, objectives, activities.
#[tauri::command]
pub fn update_plan_topic(
    db: State<DbState>,
    topic_id: String,
    topic_name: Option<String>,
    lesson_notes: Option<String>,
    objectives: Option<String>,
    activities: Option<String>,
    week_number: Option<i64>,
    duration_minutes: Option<i64>,
) -> Result<bool, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    if let Some(name) = topic_name {
        conn.execute(
            "UPDATE term_plan_topics SET topic_name = ?1 WHERE id = ?2",
            rusqlite::params![name, topic_id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(notes) = lesson_notes {
        conn.execute(
            "UPDATE term_plan_topics SET lesson_notes = ?1 WHERE id = ?2",
            rusqlite::params![notes, topic_id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(obj) = objectives {
        conn.execute(
            "UPDATE term_plan_topics SET objectives = ?1 WHERE id = ?2",
            rusqlite::params![obj, topic_id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(act) = activities {
        conn.execute(
            "UPDATE term_plan_topics SET activities = ?1 WHERE id = ?2",
            rusqlite::params![act, topic_id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(week) = week_number {
        conn.execute(
            "UPDATE term_plan_topics SET week_number = ?1 WHERE id = ?2",
            rusqlite::params![week, topic_id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(dur) = duration_minutes {
        conn.execute(
            "UPDATE term_plan_topics SET duration_minutes = ?1 WHERE id = ?2",
            rusqlite::params![dur, topic_id],
        ).map_err(|e| e.to_string())?;
    }
    Ok(true)
}

/// Delete a topic from a plan.
#[tauri::command]
pub fn delete_plan_topic(db: State<DbState>, topic_id: String) -> Result<bool, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM term_plan_topics WHERE id = ?1",
        rusqlite::params![topic_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

/// Mark a plan topic as taught (or untaught).
#[tauri::command]
pub fn mark_plan_topic_taught(
    db: State<DbState>,
    topic_id: String,
    is_taught: bool,
) -> Result<bool, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    if is_taught {
        conn.execute(
            "UPDATE term_plan_topics SET is_taught = 1, taught_at = datetime('now') WHERE id = ?1",
            rusqlite::params![topic_id],
        )
    } else {
        conn.execute(
            "UPDATE term_plan_topics SET is_taught = 0, taught_at = NULL WHERE id = ?1",
            rusqlite::params![topic_id],
        )
    }
    .map_err(|e| e.to_string())?;
    Ok(true)
}

// ── AI-assisted lesson plan generation ───────────────────────────────────────

/// Use AI to generate lesson notes + objectives + activities for a topic.
/// Updates the topic record in the database.
#[tauri::command]
pub async fn generate_plan_topic_ai(
    db: State<'_, DbState>,
    plan_topic_id: String,
    topic_name: String,
    subject: String,
    class_level: String,
    duration_minutes: i64,
) -> Result<TermPlanTopic, String> {
    let prov = provider::resolve(&db).await?;

    // Get any existing curriculum context for this topic
    let context = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        rag::search_knowledge_base(&conn, &topic_name, &subject, &class_level)
            .unwrap_or_default()
    };

    let prompt = format!(
        r#"You are an experienced Nigerian secondary school teacher preparing a lesson plan.

Create a detailed, practical lesson plan for the following:
- Topic: {}
- Subject: {}
- Class: {}
- Duration: {} minutes

{}

Return ONLY valid JSON in this exact format:
{{
  "lesson_notes": "Full markdown lesson notes with explanations, examples using Nigerian context (Naira, local examples, familiar situations). Include key concepts, worked examples, and common student mistakes to watch for.",
  "objectives": ["By the end of this lesson, students will be able to...", "..."],
  "activities": ["Introduction activity (5 min): ...", "Main teaching (20 min): ...", "Practice (10 min): ...", "Wrap-up (5 min): ..."]
}}"#,
        topic_name, subject, class_level, duration_minutes, context
    );

    let system = "You are a Nigerian curriculum expert. Generate lesson plans in JSON format only. No markdown outside the JSON.";
    let raw = provider::complete(&prov, system, &prompt, 2000).await?;

    // Extract JSON
    let json_str = extract_json(&raw);
    let parsed: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse AI response: {}", e))?;

    let lesson_notes = parsed["lesson_notes"].as_str().unwrap_or("").to_string();
    let objectives = parsed["objectives"].to_string();
    let activities = parsed["activities"].to_string();

    // Save to database
    {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE term_plan_topics
             SET lesson_notes = ?1, objectives = ?2, activities = ?3, is_ai_generated = 1
             WHERE id = ?4",
            rusqlite::params![lesson_notes, objectives, activities, plan_topic_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Re-fetch the updated topic
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, plan_id, week_number, topic_name, topic_id,
                lesson_notes, objectives, activities, duration_minutes,
                is_ai_generated, is_taught, taught_at, created_at
         FROM term_plan_topics WHERE id = ?1",
        rusqlite::params![plan_topic_id],
        |row| {
            Ok(TermPlanTopic {
                id: row.get(0)?,
                plan_id: row.get(1)?,
                week_number: row.get(2)?,
                topic_name: row.get(3)?,
                topic_id: row.get(4)?,
                lesson_notes: row.get(5)?,
                objectives: row.get(6)?,
                activities: row.get(7)?,
                duration_minutes: row.get(8)?,
                is_ai_generated: row.get::<_, i64>(9)? != 0,
                is_taught: row.get::<_, i64>(10)? != 0,
                taught_at: row.get(11)?,
                created_at: row.get(12)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// AI suggests a full list of topics for a term based on the subject/class syllabus.
#[tauri::command]
pub async fn suggest_term_topics(
    db: State<'_, DbState>,
    subject: String,
    class_level: String,
    term: i64,
    num_weeks: i64,
) -> Result<Vec<String>, String> {
    let prov = provider::resolve(&db).await?;

    // Get existing curriculum topics from DB for context
    let db_topics = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT t.name FROM topics t
             JOIN subjects s ON s.id = t.subject_id
             WHERE s.name LIKE ?1 AND s.class_level = ?2
             ORDER BY t.sort_order",
        ).ok();
        let filter = format!("%{}%", subject);
        if let Some(ref mut s) = stmt {
            s.query_map(rusqlite::params![filter, class_level], |row| row.get::<_, String>(0))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).collect::<Vec<_>>())
                .unwrap_or_default()
        } else {
            vec![]
        }
    };

    let existing = if db_topics.is_empty() {
        String::new()
    } else {
        format!("\nKnown topics in the curriculum: {}", db_topics.join(", "))
    };

    let prompt = format!(
        r#"You are a Nigerian NERDC curriculum expert.

Suggest {} topics to teach in Term {} for {} students studying {}.
These should follow the Nigerian NERDC syllabus, be ordered logically (easier to harder),
and be appropriate for a {} week term.{}

Return ONLY a JSON array of topic name strings, e.g.:
["Topic 1", "Topic 2", "Topic 3"]

No explanation, no markdown, just the JSON array."#,
        num_weeks, term, class_level, subject, num_weeks, existing
    );

    let system = "You are a Nigerian curriculum expert. Return only a JSON array of topic names.";
    let raw = provider::complete(&prov, system, &prompt, 500).await?;
    let json_str = extract_json(&raw);

    let topics: Vec<String> = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse topic suggestions: {}", e))?;

    Ok(topics)
}

fn extract_json(text: &str) -> String {
    let trimmed = text.trim();
    if let Some(start) = trimmed.find("```json") {
        let after = &trimmed[start + 7..];
        if let Some(end) = after.find("```") {
            return after[..end].trim().to_string();
        }
    }
    if let Some(start) = trimmed.find("```") {
        let after = &trimmed[start + 3..];
        if let Some(end) = after.find("```") {
            return after[..end].trim().to_string();
        }
    }
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        return trimmed.to_string();
    }
    trimmed.to_string()
}
