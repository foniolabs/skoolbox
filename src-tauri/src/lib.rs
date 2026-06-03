mod ai;
mod commands;
mod db;
mod models;

use db::{connection, DbState};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file if it exists (for API_KEY, etc.)
    let _ = dotenvy::dotenv();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Initialize database
            let conn = connection::open_db(&app.handle())?;
            connection::init_db(&conn).expect("Failed to init database schema");
            db::seed::seed_if_empty(&conn).expect("Failed to seed database");

            // Store database connection as managed state
            app.manage(DbState {
                db: Mutex::new(conn),
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ── Database: Students ──────────────────────────────────────────
            commands::database::get_all_students,
            commands::database::get_student,
            commands::database::create_student,
            // ── Database: Subjects & Topics ─────────────────────────────────
            commands::database::get_subjects,
            commands::database::get_topics,
            commands::database::get_questions,
            commands::database::mark_topic_taught,
            // ── Database: Progress ──────────────────────────────────────────
            commands::database::get_student_progress,
            commands::database::update_student_progress,
            commands::database::get_class_overview,
            // ── Database: Quizzes ───────────────────────────────────────────
            commands::database::save_quiz_attempt,
            commands::database::get_quiz_attempts,
            // ── Database: AI Lessons ────────────────────────────────────────
            commands::database::save_ai_lesson,
            commands::database::get_ai_lesson_history,
            // ── Database: Settings ──────────────────────────────────────────
            commands::database::get_setting,
            commands::database::set_setting,
            // ── Database: Videos ────────────────────────────────────────────
            commands::database::get_topic_videos,
            commands::database::add_topic_video,
            // ── AI (legacy — kept for backward compatibility) ───────────────
            commands::ai::ask_ai_tutor,
            commands::ai::generate_quiz_ai,
            commands::ai::ask_student_tutor,
            commands::ai::check_connectivity,
            // ── AI Agent (new — all 4 layers + memory + feedback) ───────────
            commands::agent::ai_agent_chat,
            commands::agent::submit_ai_feedback,
            commands::agent::process_feedback_batch,
            commands::agent::generate_conversation_summary,
            commands::agent::get_student_learning_profile,
            commands::agent::update_student_learning_profile,
            commands::agent::get_conversation_summaries,
            commands::agent::get_chat_history,
            commands::agent::get_student_mistakes,
            commands::agent::record_student_mistake,
            commands::agent::get_golden_explanations,
            commands::agent::get_topic_health,
            // ── Curriculum Planning ─────────────────────────────────────────
            commands::curriculum::create_term_plan,
            commands::curriculum::get_term_plans,
            commands::curriculum::get_active_term_plan,
            commands::curriculum::delete_term_plan,
            commands::curriculum::get_plan_topics,
            commands::curriculum::add_plan_topic,
            commands::curriculum::update_plan_topic,
            commands::curriculum::delete_plan_topic,
            commands::curriculum::mark_plan_topic_taught,
            commands::curriculum::generate_plan_topic_ai,
            commands::curriculum::suggest_term_topics,
            // ── TTS ─────────────────────────────────────────────────────────
            commands::tts::get_tts_settings,
            commands::tts::save_tts_settings,
            // ── Auth ────────────────────────────────────────────────────────
            commands::auth::login,
            commands::auth::register,
            commands::auth::get_all_users,
            commands::auth::delete_user,
            commands::auth::enroll_students,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
