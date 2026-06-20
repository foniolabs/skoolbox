use crate::db::DbState;
use crate::models::*;
use tauri::State;
use uuid::Uuid;

// ── Students ──────────────────────────────────────────────

#[tauri::command]
pub fn get_all_students(db: State<DbState>) -> Result<Vec<Student>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, full_name, class_level, avatar_url, streak_days, total_points, created_at, status FROM students ORDER BY full_name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Student {
                id: row.get(0)?,
                full_name: row.get(1)?,
                class_level: row.get(2)?,
                avatar_url: row.get(3)?,
                streak_days: row.get(4)?,
                total_points: row.get(5)?,
                created_at: row.get(6)?,
                status: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut students = Vec::new();
    for row in rows {
        students.push(row.map_err(|e| e.to_string())?);
    }
    Ok(students)
}

#[tauri::command]
pub fn get_student(db: State<DbState>, student_id: String) -> Result<Student, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, full_name, class_level, avatar_url, streak_days, total_points, created_at, status FROM students WHERE id = ?1",
        [&student_id],
        |row| {
            Ok(Student {
                id: row.get(0)?,
                full_name: row.get(1)?,
                class_level: row.get(2)?,
                avatar_url: row.get(3)?,
                streak_days: row.get(4)?,
                total_points: row.get(5)?,
                created_at: row.get(6)?,
                status: row.get(7)?,
            })
        },
    )
    .map_err(|e| format!("Student not found: {}", e))
}

#[tauri::command]
pub fn create_student(
    db: State<DbState>,
    full_name: String,
    class_level: String,
) -> Result<Student, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO students (id, full_name, class_level) VALUES (?1, ?2, ?3)",
        rusqlite::params![&id, &full_name, &class_level],
    )
    .map_err(|e| e.to_string())?;

    Ok(Student {
        id,
        full_name,
        class_level,
        avatar_url: None,
        streak_days: 0,
        total_points: 0,
        created_at: chrono::Utc::now().to_rfc3339(),
        status: "active".to_string(),
    })
}

/// Update a student's details — used when a student is corrected or **upgraded
/// to a new class**. Only the provided fields change.
#[tauri::command]
pub fn update_student(
    db: State<DbState>,
    student_id: String,
    full_name: Option<String>,
    class_level: Option<String>,
) -> Result<(), String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    if let Some(name) = full_name {
        conn.execute(
            "UPDATE students SET full_name = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![name, student_id],
        )
        .map_err(|e| e.to_string())?;
        // Keep the linked login account's display name in sync.
        let _ = conn.execute(
            "UPDATE users SET full_name = ?1 WHERE student_id = ?2",
            rusqlite::params![name, student_id],
        );
    }
    if let Some(class) = class_level {
        conn.execute(
            "UPDATE students SET class_level = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![class, student_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Suspend or reactivate a student — used when a student **leaves** (suspend)
/// or returns. Suspended students cannot log in. `status` is 'active' | 'suspended'.
#[tauri::command]
pub fn set_student_status(
    db: State<DbState>,
    student_id: String,
    status: String,
) -> Result<(), String> {
    if status != "active" && status != "suspended" {
        return Err("Status must be 'active' or 'suspended'.".to_string());
    }
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE students SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![status, student_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Subjects & Topics ─────────────────────────────────────

#[tauri::command]
pub fn get_subjects(db: State<DbState>, class_level: Option<String>) -> Result<Vec<Subject>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    let (sql, params): (&str, Vec<String>) = match &class_level {
        Some(cl) => (
            "SELECT id, name, icon, class_level, description FROM subjects WHERE class_level = ?1 ORDER BY name",
            vec![cl.clone()],
        ),
        None => (
            "SELECT id, name, icon, class_level, description FROM subjects ORDER BY name",
            vec![],
        ),
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            Ok(Subject {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                class_level: row.get(3)?,
                description: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut subjects = Vec::new();
    for row in rows {
        subjects.push(row.map_err(|e| e.to_string())?);
    }
    Ok(subjects)
}

#[tauri::command]
pub fn get_topics(db: State<DbState>, subject_id: String) -> Result<Vec<Topic>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, subject_id, name, description, sort_order, is_locked, COALESCE(is_taught, 0), estimated_minutes FROM topics WHERE subject_id = ?1 ORDER BY sort_order")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&subject_id], |row| {
            Ok(Topic {
                id: row.get(0)?,
                subject_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                sort_order: row.get(4)?,
                is_locked: row.get::<_, i32>(5)? != 0,
                is_taught: row.get::<_, i32>(6)? != 0,
                estimated_minutes: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut topics = Vec::new();
    for row in rows {
        topics.push(row.map_err(|e| e.to_string())?);
    }
    Ok(topics)
}

#[tauri::command]
pub fn get_questions(
    db: State<DbState>,
    topic_id: String,
    difficulty: Option<i32>,
    limit: Option<i32>,
) -> Result<Vec<Question>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    let lim = limit.unwrap_or(20);
    let mut sql = String::from(
        "SELECT id, topic_id, question_text, question_type, options, correct_answer, explanation, difficulty FROM questions WHERE topic_id = ?1",
    );
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(topic_id)];

    if let Some(diff) = difficulty {
        sql.push_str(" AND difficulty = ?2");
        params.push(Box::new(diff));
    }

    sql.push_str(&format!(" ORDER BY RANDOM() LIMIT {}", lim));

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(Question {
                id: row.get(0)?,
                topic_id: row.get(1)?,
                question_text: row.get(2)?,
                question_type: row.get(3)?,
                options: row.get(4)?,
                correct_answer: row.get(5)?,
                explanation: row.get(6)?,
                difficulty: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut questions = Vec::new();
    for row in rows {
        questions.push(row.map_err(|e| e.to_string())?);
    }
    Ok(questions)
}

// ── Student Progress ──────────────────────────────────────

#[tauri::command]
pub fn get_student_progress(
    db: State<DbState>,
    student_id: String,
) -> Result<Vec<StudentProgress>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, student_id, topic_id, status, score, time_spent_seconds, last_accessed, mastery_level FROM student_progress WHERE student_id = ?1")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&student_id], |row| {
            Ok(StudentProgress {
                id: row.get(0)?,
                student_id: row.get(1)?,
                topic_id: row.get(2)?,
                status: row.get(3)?,
                score: row.get(4)?,
                time_spent_seconds: row.get(5)?,
                last_accessed: row.get(6)?,
                mastery_level: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut progress = Vec::new();
    for row in rows {
        progress.push(row.map_err(|e| e.to_string())?);
    }
    Ok(progress)
}

#[tauri::command]
pub fn update_student_progress(
    db: State<DbState>,
    student_id: String,
    topic_id: String,
    score: f64,
    status: String,
) -> Result<(), String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let id = format!("{}-{}", student_id, topic_id);
    let mastery = if score >= 80.0 {
        "mastered"
    } else if score >= 50.0 {
        "working_towards"
    } else {
        "needs_attention"
    };

    conn.execute(
        "INSERT INTO student_progress (id, student_id, topic_id, status, score, mastery_level, last_accessed)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
         ON CONFLICT(student_id, topic_id) DO UPDATE SET
           status = ?4, score = ?5, mastery_level = ?6, last_accessed = datetime('now')",
        rusqlite::params![&id, &student_id, &topic_id, &status, score, mastery],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_class_overview(
    db: State<DbState>,
    class_level: String,
) -> Result<ClassOverview, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    let total_students: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM students WHERE class_level = ?1",
            [&class_level],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let avg_score: f64 = conn
        .query_row(
            "SELECT COALESCE(AVG(sp.score), 0) FROM student_progress sp
             JOIN students s ON s.id = sp.student_id WHERE s.class_level = ?1",
            [&class_level],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let mastered: i32 = conn
        .query_row(
            "SELECT COUNT(DISTINCT sp.student_id) FROM student_progress sp
             JOIN students s ON s.id = sp.student_id
             WHERE s.class_level = ?1 AND sp.mastery_level = 'mastered'",
            [&class_level],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let working: i32 = conn
        .query_row(
            "SELECT COUNT(DISTINCT sp.student_id) FROM student_progress sp
             JOIN students s ON s.id = sp.student_id
             WHERE s.class_level = ?1 AND sp.mastery_level = 'working_towards'",
            [&class_level],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let needs_att: i32 = conn
        .query_row(
            "SELECT COUNT(DISTINCT sp.student_id) FROM student_progress sp
             JOIN students s ON s.id = sp.student_id
             WHERE s.class_level = ?1 AND sp.mastery_level = 'needs_attention'",
            [&class_level],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_work: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM topics t
             JOIN subjects s ON s.id = t.subject_id WHERE s.class_level = ?1",
            [&class_level],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(ClassOverview {
        total_students,
        average_score: avg_score,
        mastered_count: mastered,
        working_towards_count: working,
        needs_attention_count: needs_att,
        total_work_assigned: total_work,
    })
}

// ── Quiz Attempts ─────────────────────────────────────────

#[tauri::command]
pub fn save_quiz_attempt(
    db: State<DbState>,
    student_id: String,
    subject_id: Option<String>,
    topic_id: Option<String>,
    quiz_type: String,
    total_questions: i32,
    correct_answers: i32,
    score: f64,
    time_taken_seconds: Option<i32>,
    questions_data: Option<String>,
) -> Result<QuizAttempt, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO quiz_attempts (id, student_id, subject_id, topic_id, quiz_type, total_questions, correct_answers, score, time_taken_seconds, questions_data)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![&id, &student_id, &subject_id, &topic_id, &quiz_type, total_questions, correct_answers, score, &time_taken_seconds, &questions_data],
    )
    .map_err(|e| e.to_string())?;

    Ok(QuizAttempt {
        id,
        student_id,
        subject_id,
        topic_id,
        quiz_type,
        total_questions,
        correct_answers,
        score,
        time_taken_seconds,
        questions_data,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn get_quiz_attempts(
    db: State<DbState>,
    student_id: String,
) -> Result<Vec<QuizAttempt>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, student_id, subject_id, topic_id, quiz_type, total_questions, correct_answers, score, time_taken_seconds, questions_data, created_at
             FROM quiz_attempts WHERE student_id = ?1 ORDER BY created_at DESC LIMIT 50",
        )
        .map_err(|e| e.to_string())?;

    let attempts = stmt
        .query_map(rusqlite::params![&student_id], |row| {
            Ok(QuizAttempt {
                id: row.get(0)?,
                student_id: row.get(1)?,
                subject_id: row.get(2)?,
                topic_id: row.get(3)?,
                quiz_type: row.get(4)?,
                total_questions: row.get(5)?,
                correct_answers: row.get(6)?,
                score: row.get(7)?,
                time_taken_seconds: row.get(8)?,
                questions_data: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(attempts)
}

// ── AI Lesson History ─────────────────────────────────────

#[tauri::command]
pub fn save_ai_lesson(
    db: State<DbState>,
    teacher_command: String,
    subject: Option<String>,
    class_level: Option<String>,
    mode: String,
    lesson_data: String,
) -> Result<AILesson, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO ai_lessons (id, teacher_command, subject, class_level, mode, lesson_data)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![&id, &teacher_command, &subject, &class_level, &mode, &lesson_data],
    )
    .map_err(|e| e.to_string())?;

    Ok(AILesson {
        id,
        teacher_command,
        subject,
        class_level,
        mode,
        lesson_data,
        duration_seconds: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn get_ai_lesson_history(db: State<DbState>) -> Result<Vec<AILesson>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, teacher_command, subject, class_level, mode, lesson_data, duration_seconds, created_at FROM ai_lessons ORDER BY created_at DESC LIMIT 50")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(AILesson {
                id: row.get(0)?,
                teacher_command: row.get(1)?,
                subject: row.get(2)?,
                class_level: row.get(3)?,
                mode: row.get(4)?,
                lesson_data: row.get(5)?,
                duration_seconds: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut lessons = Vec::new();
    for row in rows {
        lessons.push(row.map_err(|e| e.to_string())?);
    }
    Ok(lessons)
}

// ── Settings ──────────────────────────────────────────────

#[tauri::command]
pub fn get_setting(db: State<DbState>, key: String) -> Result<Option<String>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        [&key],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_setting(db: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
        rusqlite::params![&key, &value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Topic Management ─────────────────────────────────

#[tauri::command]
pub fn mark_topic_taught(
    db: State<DbState>,
    topic_id: String,
    is_taught: bool,
) -> Result<(), String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let taught_val: i32 = if is_taught { 1 } else { 0 };
    // When marking as taught, also unlock it for students
    let locked_val: i32 = if is_taught { 0 } else { 1 };
    conn.execute(
        "UPDATE topics SET is_taught = ?2, is_locked = ?3 WHERE id = ?1",
        rusqlite::params![&topic_id, taught_val, locked_val],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Videos ───────────────────────────────────────────

#[tauri::command]
pub fn get_topic_videos(
    db: State<DbState>,
    subject: String,
    topic: String,
) -> Result<Vec<Video>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, youtube_id, subject, topic, class_level, duration_seconds, description, source, created_at FROM videos WHERE subject = ?1 AND topic = ?2 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![&subject, &topic], |row| {
            Ok(Video {
                id: row.get(0)?,
                title: row.get(1)?,
                youtube_id: row.get(2)?,
                subject: row.get(3)?,
                topic: row.get(4)?,
                class_level: row.get(5)?,
                duration_seconds: row.get(6)?,
                description: row.get(7)?,
                source: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut videos = Vec::new();
    for row in rows {
        videos.push(row.map_err(|e| e.to_string())?);
    }
    Ok(videos)
}

#[tauri::command]
pub fn add_topic_video(
    db: State<DbState>,
    title: String,
    youtube_id: String,
    subject: String,
    topic: String,
    class_level: String,
    description: Option<String>,
) -> Result<Video, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO videos (id, title, youtube_id, subject, topic, class_level, description, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'youtube')",
        rusqlite::params![&id, &title, &youtube_id, &subject, &topic, &class_level, &description],
    )
    .map_err(|e| e.to_string())?;

    Ok(Video {
        id,
        title,
        youtube_id: Some(youtube_id),
        subject,
        topic: Some(topic),
        class_level: Some(class_level),
        duration_seconds: None,
        description,
        source: "youtube".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}
