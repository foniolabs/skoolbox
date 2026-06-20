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

            // First run: load a pre-installed curriculum pack if one is bundled.
            // (Producers ship `default_curriculum_pack.json` as a Tauri resource;
            // schools get the curriculum out of the box. Best-effort — skipped if
            // absent or already populated.)
            if let Ok(pack_path) =
                app.path().resolve("default_curriculum_pack.json", tauri::path::BaseDirectory::Resource)
            {
                if let Ok(json) = std::fs::read_to_string(&pack_path) {
                    match commands::knowledge::seed_pack_if_empty(&conn, &json) {
                        Ok(s) if s.documents > 0 => {
                            log::info!("Seeded {} curriculum documents from bundled pack", s.documents)
                        }
                        Err(e) => log::warn!("Bundled curriculum pack not loaded: {e}"),
                        _ => {}
                    }
                }
            }

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
            commands::database::update_student,
            commands::database::set_student_status,
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
            // ── Classroom Engine (Martha leads a class) ─────────────────────
            commands::classroom::classroom_start_lesson,
            commands::classroom::classroom_plan_lesson,
            commands::classroom::classroom_teach_segment,
            commands::classroom::classroom_evaluate_answer,
            commands::classroom::bake_lesson,
            commands::classroom::get_generated_lesson,
            commands::classroom::list_generated_lessons,
            // ── Curriculum Knowledge Base (RAG ingestion) ───────────────────
            commands::knowledge::ingest_curriculum_text,
            commands::knowledge::list_curriculum_documents,
            commands::knowledge::delete_curriculum_document,
            commands::knowledge::curriculum_stats,
            commands::knowledge::export_curriculum_pack,
            commands::knowledge::import_curriculum_pack,
            // ── TTS ─────────────────────────────────────────────────────────
            commands::tts::get_tts_settings,
            commands::tts::save_tts_settings,
            commands::tts::speak_text,
            commands::tts::stop_speaking,
            commands::tts::tts_available,
            // ── Auth ────────────────────────────────────────────────────────
            commands::auth::login,
            commands::auth::register,
            commands::auth::get_all_users,
            commands::auth::delete_user,
            commands::auth::delete_student,
            commands::auth::enroll_students,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
