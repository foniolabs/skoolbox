use rusqlite::Connection;

/// Search the local knowledge base for curriculum content relevant to a query.
/// Returns formatted context string to inject into the AI prompt.
pub fn search_knowledge_base(
    conn: &Connection,
    query: &str,
    subject: &str,
    class_level: &str,
) -> Result<String, String> {
    let search_term = format!("%{}%", query);
    let subject_filter = format!("%{}%", subject);
    let mut context_parts: Vec<String> = Vec::new();

    // Search topics
    let mut stmt = conn
        .prepare(
            "SELECT t.name, t.description, s.name as subject_name
             FROM topics t
             JOIN subjects s ON s.id = t.subject_id
             WHERE (t.name LIKE ?1 OR t.description LIKE ?1)
             AND s.name LIKE ?2
             AND s.class_level = ?3
             LIMIT 5",
        )
        .map_err(|e| e.to_string())?;

    let topic_rows = stmt
        .query_map(
            rusqlite::params![&search_term, &subject_filter, class_level],
            |row| {
                let name: String = row.get(0)?;
                let desc: Option<String> = row.get(1)?;
                let subj: String = row.get(2)?;
                Ok(format!(
                    "Topic: {} ({})\n{}",
                    name,
                    subj,
                    desc.unwrap_or_default()
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    for row in topic_rows {
        if let Ok(text) = row {
            context_parts.push(text);
        }
    }

    // Search lessons
    let mut lesson_stmt = conn
        .prepare(
            "SELECT l.title, l.content_summary
             FROM lessons l
             JOIN topics t ON t.id = l.topic_id
             JOIN subjects s ON s.id = t.subject_id
             WHERE (l.title LIKE ?1 OR l.content_summary LIKE ?1)
             AND s.class_level = ?2
             LIMIT 5",
        )
        .map_err(|e| e.to_string())?;

    let lesson_rows = lesson_stmt
        .query_map(rusqlite::params![&search_term, class_level], |row| {
            let title: String = row.get(0)?;
            let summary: Option<String> = row.get(1)?;
            Ok(format!(
                "Lesson: {}\n{}",
                title,
                summary.unwrap_or_default()
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in lesson_rows {
        if let Ok(text) = row {
            context_parts.push(text);
        }
    }

    if context_parts.is_empty() {
        Ok(String::new())
    } else {
        Ok(format!(
            "Relevant curriculum content:\n---\n{}\n---",
            context_parts.join("\n\n")
        ))
    }
}

/// Enhanced RAG search that includes teaching notes, golden explanations,
/// and (optionally) student-specific mistake history.
pub fn search_knowledge_base_enhanced(
    conn: &Connection,
    query: &str,
    subject: &str,
    class_level: &str,
    student_id: Option<&str>,
) -> Result<String, String> {
    let search_term = format!("%{}%", query);
    let subject_filter = format!("%{}%", subject);
    let mut sections: Vec<String> = Vec::new();

    // 1. Curriculum topics & lessons (existing search)
    let base = search_knowledge_base(conn, query, subject, class_level).unwrap_or_default();
    if !base.is_empty() {
        sections.push(base);
    }

    // 2. Teaching notes — common misconceptions + best approaches
    let mut notes_stmt = conn
        .prepare(
            "SELECT tn.common_misconceptions, tn.best_approaches, tn.real_life_examples, t.name
             FROM teaching_notes tn
             JOIN topics t ON t.id = tn.topic_id
             WHERE t.name LIKE ?1
             LIMIT 3",
        )
        .ok();

    if let Some(ref mut stmt) = notes_stmt {
        let rows = stmt.query_map(rusqlite::params![&search_term], |row| {
            let misconceptions: Option<String> = row.get(0)?;
            let approaches: Option<String> = row.get(1)?;
            let examples: Option<String> = row.get(2)?;
            let topic_name: String = row.get(3)?;
            Ok((topic_name, misconceptions, approaches, examples))
        });

        if let Ok(rows) = rows {
            let mut note_parts = Vec::new();
            for row in rows.flatten() {
                let (name, misconceptions, approaches, examples) = row;
                let mut note = format!("Teaching notes for {}:", name);
                if let Some(m) = misconceptions {
                    if !m.is_empty() && m != "null" {
                        note.push_str(&format!("\nCommon misconceptions: {}", m));
                    }
                }
                if let Some(a) = approaches {
                    if !a.is_empty() && a != "null" {
                        note.push_str(&format!("\nBest approaches: {}", a));
                    }
                }
                if let Some(e) = examples {
                    if !e.is_empty() && e != "null" {
                        note.push_str(&format!("\nNigerian examples: {}", e));
                    }
                }
                note_parts.push(note);
            }
            if !note_parts.is_empty() {
                sections.push(format!(
                    "## Teaching Notes\n{}",
                    note_parts.join("\n\n")
                ));
            }
        }
    }

    // 3. Golden explanations — best AI responses for this topic
    let mut golden_stmt = conn
        .prepare(
            "SELECT ge.student_question, ge.ai_response
             FROM golden_explanations ge
             JOIN topics t ON t.id = ge.topic_id
             WHERE t.name LIKE ?1
             ORDER BY ge.feedback_score DESC
             LIMIT 2",
        )
        .ok();

    if let Some(ref mut stmt) = golden_stmt {
        let rows = stmt.query_map(rusqlite::params![&search_term], |row| {
            let question: String = row.get(0)?;
            let response: String = row.get(1)?;
            Ok((question, response))
        });

        if let Ok(rows) = rows {
            let mut golden_parts = Vec::new();
            for row in rows.flatten() {
                golden_parts.push(format!(
                    "Q: {}\nA (highly rated): {}",
                    row.0,
                    &row.1[..row.1.len().min(400)]  // truncate long examples
                ));
            }
            if !golden_parts.is_empty() {
                sections.push(format!(
                    "## Examples of Great Explanations (use as style reference)\n{}",
                    golden_parts.join("\n\n")
                ));
            }
        }
    }

    // 4. Student mistake history — if a specific student is asking
    if let Some(sid) = student_id {
        let mut mistake_stmt = conn
            .prepare(
                "SELECT sm.mistake_description, sm.occurrence_count, t.name
                 FROM student_mistakes sm
                 JOIN topics t ON t.id = sm.topic_id
                 WHERE sm.student_id = ?1
                 AND sm.is_resolved = 0
                 AND t.name LIKE ?2
                 ORDER BY sm.occurrence_count DESC
                 LIMIT 5",
            )
            .ok();

        if let Some(ref mut stmt) = mistake_stmt {
            let rows = stmt.query_map(rusqlite::params![sid, &search_term], |row| {
                let desc: String = row.get(0)?;
                let count: i64 = row.get(1)?;
                let topic: String = row.get(2)?;
                Ok(format!(
                    "- {} (occurred {} time{}): {}",
                    topic,
                    count,
                    if count == 1 { "" } else { "s" },
                    desc
                ))
            });

            if let Ok(rows) = rows {
                let mistakes: Vec<String> = rows.flatten().collect();
                if !mistakes.is_empty() {
                    sections.push(format!(
                        "## This Student's Known Mistakes (proactively address these)\n{}",
                        mistakes.join("\n")
                    ));
                }
            }
        }
    }

    if sections.is_empty() {
        Ok(String::new())
    } else {
        Ok(sections.join("\n\n"))
    }
}

/// Build the student context string injected into every agent call.
/// Includes: profile, recent conversation summaries, recent quiz scores, active mistakes.
pub fn build_student_context(
    conn: &Connection,
    student_id: &str,
    student_name: &str,
    class_level: &str,
) -> String {
    let mut parts = Vec::new();

    // 1. Profile
    let profile_info = conn.query_row(
        "SELECT overall_mastery_level, confidence_level, preferred_explanation_type,
                total_ai_conversations, last_conversation_summary
         FROM student_learning_profile WHERE student_id = ?1",
        rusqlite::params![student_id],
        |row| {
            let mastery: String = row.get(0)?;
            let confidence: String = row.get(1)?;
            let style: String = row.get(2)?;
            let convos: i64 = row.get(3)?;
            let last_summary: Option<String> = row.get(4)?;
            Ok((mastery, confidence, style, convos, last_summary))
        },
    );

    if let Ok((mastery, confidence, style, convos, last_summary)) = profile_info {
        let mut profile = format!(
            "## Student Profile\nName: {}\nClass: {}\nMastery Level: {}\nConfidence: {}",
            student_name, class_level, mastery, confidence
        );
        if style != "unknown" {
            profile.push_str(&format!("\nPreferred Explanation Style: {}", style));
        }
        if convos > 0 {
            profile.push_str(&format!("\nPrevious AI Conversations: {}", convos));
        }
        if let Some(summary) = last_summary {
            profile.push_str(&format!("\nLast Session Summary: {}", summary));
        }
        parts.push(profile);
    } else {
        parts.push(format!(
            "## Student Profile\nName: {}\nClass: {}",
            student_name, class_level
        ));
    }

    // 2. Recent conversation summaries (last 3)
    let mut summary_stmt = conn
        .prepare(
            "SELECT subject, topic, summary FROM conversation_summaries
             WHERE student_id = ?1
             ORDER BY session_date DESC
             LIMIT 3",
        )
        .ok();

    if let Some(ref mut stmt) = summary_stmt {
        let rows = stmt.query_map(rusqlite::params![student_id], |row| {
            let subject: String = row.get(0)?;
            let topic: Option<String> = row.get(1)?;
            let summary: String = row.get(2)?;
            Ok(format!(
                "- {} {}: {}",
                subject,
                topic.map(|t| format!("({})", t)).unwrap_or_default(),
                summary
            ))
        });

        if let Ok(rows) = rows {
            let summaries: Vec<String> = rows.flatten().collect();
            if !summaries.is_empty() {
                parts.push(format!(
                    "## Recent Learning History\n{}",
                    summaries.join("\n")
                ));
            }
        }
    }

    // 3. Recent quiz performance (last 3)
    let mut quiz_stmt = conn
        .prepare(
            "SELECT subject_id, score, correct_answers, total_questions, created_at
             FROM quiz_attempts
             WHERE student_id = ?1
             ORDER BY created_at DESC
             LIMIT 3",
        )
        .ok();

    if let Some(ref mut stmt) = quiz_stmt {
        let rows = stmt.query_map(rusqlite::params![student_id], |row| {
            let subject: Option<String> = row.get(0)?;
            let score: f64 = row.get(1)?;
            let correct: i64 = row.get(2)?;
            let total: i64 = row.get(3)?;
            Ok(format!(
                "- {}: {}% ({}/{})",
                subject.unwrap_or_else(|| "Quiz".to_string()),
                score as i64,
                correct,
                total
            ))
        });

        if let Ok(rows) = rows {
            let quizzes: Vec<String> = rows.flatten().collect();
            if !quizzes.is_empty() {
                parts.push(format!(
                    "## Recent Quiz Performance\n{}",
                    quizzes.join("\n")
                ));
            }
        }
    }

    // 4. All active (unresolved) mistakes across subjects
    let mut mistake_stmt = conn
        .prepare(
            "SELECT sm.mistake_description, t.name as topic_name, sm.occurrence_count
             FROM student_mistakes sm
             JOIN topics t ON t.id = sm.topic_id
             WHERE sm.student_id = ?1 AND sm.is_resolved = 0
             ORDER BY sm.occurrence_count DESC
             LIMIT 5",
        )
        .ok();

    if let Some(ref mut stmt) = mistake_stmt {
        let rows = stmt.query_map(rusqlite::params![student_id], |row| {
            let desc: String = row.get(0)?;
            let topic: String = row.get(1)?;
            let count: i64 = row.get(2)?;
            Ok(format!("- {} ({}x): {}", topic, count, desc))
        });

        if let Ok(rows) = rows {
            let mistakes: Vec<String> = rows.flatten().collect();
            if !mistakes.is_empty() {
                parts.push(format!(
                    "## Recurring Mistakes to Proactively Address\n{}",
                    mistakes.join("\n")
                ));
            }
        }
    }

    if parts.is_empty() {
        String::new()
    } else {
        parts.join("\n\n")
    }
}
