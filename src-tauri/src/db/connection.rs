use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

/// Get the database path in the app's data directory.
pub fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    std::fs::create_dir_all(&app_dir).ok();
    app_dir.join("skoolbox.db")
}

/// Open a new connection to the SQLite database.
pub fn open_db(app: &AppHandle) -> Result<Connection, String> {
    let path = get_db_path(app);
    Connection::open(&path).map_err(|e| format!("Failed to open database: {}", e))
}

/// Initialize the database schema. Called once at app startup.
pub fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            class_level TEXT NOT NULL,
            avatar_url TEXT,
            streak_days INTEGER DEFAULT 0,
            total_points INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS subjects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT,
            class_level TEXT NOT NULL,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS topics (
            id TEXT PRIMARY KEY,
            subject_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            is_locked INTEGER DEFAULT 1,
            is_taught INTEGER DEFAULT 0,
            estimated_minutes INTEGER DEFAULT 30,
            FOREIGN KEY (subject_id) REFERENCES subjects(id)
        );

        CREATE TABLE IF NOT EXISTS lessons (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            title TEXT NOT NULL,
            content_markdown TEXT,
            content_summary TEXT,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );

        CREATE TABLE IF NOT EXISTS questions (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            question_text TEXT NOT NULL,
            question_type TEXT DEFAULT 'mcq',
            options TEXT,
            correct_answer TEXT NOT NULL,
            explanation TEXT,
            difficulty INTEGER DEFAULT 3,
            times_shown INTEGER DEFAULT 0,
            times_correct INTEGER DEFAULT 0,
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );

        CREATE TABLE IF NOT EXISTS student_progress (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            topic_id TEXT NOT NULL,
            status TEXT DEFAULT 'not_started',
            score REAL DEFAULT 0,
            time_spent_seconds INTEGER DEFAULT 0,
            last_accessed TEXT,
            mastery_level TEXT DEFAULT 'needs_attention',
            UNIQUE(student_id, topic_id),
            FOREIGN KEY (student_id) REFERENCES students(id),
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );

        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            subject_id TEXT,
            topic_id TEXT,
            quiz_type TEXT NOT NULL,
            total_questions INTEGER NOT NULL,
            correct_answers INTEGER NOT NULL,
            score REAL NOT NULL,
            time_taken_seconds INTEGER,
            questions_data TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (student_id) REFERENCES students(id)
        );

        CREATE TABLE IF NOT EXISTS ai_lessons (
            id TEXT PRIMARY KEY,
            teacher_command TEXT NOT NULL,
            subject TEXT,
            class_level TEXT,
            mode TEXT NOT NULL,
            lesson_data TEXT NOT NULL,
            duration_seconds INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            youtube_id TEXT,
            subject TEXT NOT NULL,
            topic TEXT,
            class_level TEXT,
            duration_seconds INTEGER,
            description TEXT,
            file_path TEXT,
            is_downloaded INTEGER DEFAULT 0,
            source TEXT DEFAULT 'youtube',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            data TEXT NOT NULL,
            is_synced INTEGER DEFAULT 0,
            retry_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'student',
            student_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (student_id) REFERENCES students(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )
    .map_err(|e| format!("Failed to initialize database: {}", e))?;

    // ── Term Curriculum Planning tables ──────────────────────────────────────

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS term_plans (
            id TEXT PRIMARY KEY,
            subject_id TEXT NOT NULL,
            subject_name TEXT NOT NULL,
            class_level TEXT NOT NULL,
            term INTEGER NOT NULL,
            academic_year TEXT NOT NULL DEFAULT '2024/2025',
            title TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (subject_id) REFERENCES subjects(id)
        );

        CREATE TABLE IF NOT EXISTS term_plan_topics (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            week_number INTEGER NOT NULL,
            topic_name TEXT NOT NULL,
            topic_id TEXT,
            lesson_notes TEXT,
            objectives TEXT,
            activities TEXT,
            duration_minutes INTEGER DEFAULT 40,
            is_ai_generated INTEGER DEFAULT 0,
            is_taught INTEGER DEFAULT 0,
            taught_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (plan_id) REFERENCES term_plans(id),
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );
        ",
    )
    .map_err(|e| format!("Failed to create curriculum tables: {}", e))?;

    // ── Agent / AI Memory tables ──────────────────────────────────────────────

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS chat_history (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            subject TEXT,
            topic TEXT,
            conversation_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (student_id) REFERENCES students(id)
        );

        CREATE TABLE IF NOT EXISTS student_learning_profile (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL UNIQUE,
            preferred_explanation_type TEXT DEFAULT 'unknown',
            strongest_subjects TEXT DEFAULT '[]',
            weakest_subjects TEXT DEFAULT '[]',
            strongest_topics TEXT DEFAULT '[]',
            weakest_topics TEXT DEFAULT '[]',
            overall_mastery_level TEXT DEFAULT 'developing',
            confidence_level TEXT DEFAULT 'medium',
            frustration_indicators INTEGER DEFAULT 0,
            total_ai_conversations INTEGER DEFAULT 0,
            total_ai_messages INTEGER DEFAULT 0,
            topics_discussed TEXT DEFAULT '[]',
            last_conversation_summary TEXT,
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (student_id) REFERENCES students(id)
        );

        CREATE TABLE IF NOT EXISTS student_mistakes (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            topic_id TEXT NOT NULL,
            mistake_type TEXT NOT NULL,
            mistake_description TEXT NOT NULL,
            occurrence_count INTEGER DEFAULT 1,
            last_occurred TEXT DEFAULT (datetime('now')),
            is_resolved INTEGER DEFAULT 0,
            resolved_at TEXT,
            FOREIGN KEY (student_id) REFERENCES students(id),
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );

        CREATE TABLE IF NOT EXISTS conversation_summaries (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            subject TEXT NOT NULL,
            topic TEXT,
            summary TEXT NOT NULL,
            key_insights TEXT,
            messages_count INTEGER,
            session_date TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (student_id) REFERENCES students(id)
        );

        CREATE TABLE IF NOT EXISTS teaching_notes (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL REFERENCES topics(id),
            common_misconceptions TEXT,
            best_approaches TEXT,
            real_life_examples TEXT,
            prerequisite_topics TEXT,
            difficulty_rating REAL DEFAULT 3.0,
            estimated_teaching_minutes INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS golden_explanations (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            student_question TEXT NOT NULL,
            ai_response TEXT NOT NULL,
            feedback_score REAL NOT NULL,
            times_reused INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ai_feedback (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            conversation_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            feedback_type TEXT NOT NULL,
            feedback_detail TEXT,
            topic_id TEXT,
            subject TEXT,
            ai_response_text TEXT NOT NULL,
            student_question TEXT NOT NULL,
            quiz_score_after REAL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        ",
    )
    .map_err(|e| format!("Failed to create agent tables: {}", e))?;

    // ── Curriculum / Textbook knowledge base (RAG ingestion) ─────────────────
    //
    // This is where uploaded NERDC curriculum, textbooks, lesson notes and past
    // questions live. Documents are split into chunks; the chunks are full-text
    // indexed with FTS5 so Martha can retrieve relevant passages at question
    // time and answer grounded in real curriculum content.
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS curriculum_documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            curriculum TEXT,
            subject TEXT,
            class_level TEXT,
            topic TEXT,
            -- textbook | curriculum | past_questions | lesson_notes | tutor_qa
            source_type TEXT NOT NULL DEFAULT 'textbook',
            source_file TEXT,
            is_exam_bank INTEGER NOT NULL DEFAULT 0,
            chunk_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- FTS5 stores the chunk text itself + metadata for filtering/provenance.
        -- Mirrors rag/ingest.py exactly so the Python-built index is a drop-in.
        -- (rusqlite's bundled SQLite is compiled with FTS5 enabled.)
        CREATE VIRTUAL TABLE IF NOT EXISTS curriculum_fts USING fts5(
            content,
            title UNINDEXED,
            curriculum UNINDEXED,
            subject UNINDEXED,
            class_level UNINDEXED,
            topic UNINDEXED,
            source_type UNINDEXED,
            is_exam_bank UNINDEXED,
            document_id UNINDEXED,
            tokenize = 'porter unicode61'
        );
        ",
    )
    .map_err(|e| format!("Failed to create curriculum knowledge-base tables: {}", e))?;

    // Pre-generated ("baked") lessons: full segmented lessons produced once on
    // capable hardware, distributed in packs, and PLAYED instantly on school
    // machines (no live LLM generation needed). The local model is then only
    // used for short interactions (student questions, answer checking).
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS generated_lessons (
            id TEXT PRIMARY KEY,
            subject TEXT NOT NULL,
            class_level TEXT NOT NULL,
            topic TEXT NOT NULL,
            title TEXT,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(subject, class_level, topic)
        );
        ",
    )
    .map_err(|e| format!("Failed to create generated_lessons table: {}", e))?;

    // Migrations for existing databases
    let _ = conn.execute("ALTER TABLE topics ADD COLUMN is_taught INTEGER DEFAULT 0", []);
    // Student lifecycle status: 'active' | 'suspended'. Suspended students can't log in.
    let _ = conn.execute(
        "ALTER TABLE students ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
        [],
    );

    Ok(())
}

/// Database state managed by Tauri.
pub struct DbState {
    pub db: Mutex<Connection>,
}
