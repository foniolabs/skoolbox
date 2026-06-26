use rusqlite::Connection;

/// Turn a free-text query into a safe FTS5 MATCH expression.
///
/// FTS5 treats many characters as operators, so a raw user question can be a
/// syntax error. We keep alphanumeric tokens, quote each one, and OR them
/// together — robust and good enough for curriculum recall.
fn to_fts_match(query: &str) -> Option<String> {
    let terms: Vec<String> = query
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.len() > 2) // drop noise like "a", "of", "is"
        .map(|t| format!("\"{}\"", t.to_lowercase()))
        .collect();
    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" OR "))
    }
}

/// Retrieval strategy, mirroring docs/CURRICULUM_ARCHITECTURE.md §4.3 and
/// skoolbox-config.json -> rag.retrieval_modes. `Auto` resolves to `Standard`
/// for normal classes and `Tiered` for exam classes (P5, P6, JSS3, SS3).
#[derive(Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)] // Remediation/Revision are selected by the app at runtime
pub enum RetrievalMode {
    Auto,
    Standard,
    Tiered,
    Remediation,
    Revision,
}

struct TierWeights {
    own_class: f64,
    prerequisites: f64,
    exam_bank: f64,
}

impl RetrievalMode {
    fn weights(self) -> TierWeights {
        match self {
            RetrievalMode::Standard | RetrievalMode::Auto => TierWeights {
                own_class: 1.0,
                prerequisites: 0.0,
                exam_bank: 0.0,
            },
            RetrievalMode::Tiered => TierWeights {
                own_class: 0.70,
                prerequisites: 0.25,
                exam_bank: 0.05,
            },
            RetrievalMode::Remediation => TierWeights {
                own_class: 0.20,
                prerequisites: 0.75,
                exam_bank: 0.05,
            },
            RetrievalMode::Revision => TierWeights {
                own_class: 0.40,
                prerequisites: 0.40,
                exam_bank: 0.20,
            },
        }
    }
}

/// Prerequisite class levels for the Nigerian curriculum. Mirrors
/// rag/scaffold_metadata.py so the app and the offline-built index agree.
fn prerequisite_levels(class_level: &str) -> Vec<String> {
    let prereqs: &[&str] = match class_level.to_lowercase().as_str() {
        "primary5" => &["primary1", "primary2", "primary3", "primary4"],
        "primary6" => &["primary1", "primary2", "primary3", "primary4", "primary5"],
        "jss3" => &["jss1", "jss2"],
        "ss3" => &["ss1", "ss2"],
        _ => &[],
    };
    prereqs.iter().map(|s| s.to_string()).collect()
}

fn is_exam_class(class_level: &str) -> bool {
    matches!(
        class_level.to_lowercase().as_str(),
        "primary5" | "primary6" | "jss3" | "ss3"
    )
}

/// One weighted retrieval tier: an FTS5 query over a set of class levels,
/// returning (BM25 relevance, formatted passage) pairs. `exam_only` selects the
/// exam-bank rows (`is_exam_bank = '1'`) vs. ordinary content.
fn query_tier(
    conn: &Connection,
    match_expr: &str,
    curriculum: &str,
    subject: &str,
    levels: &[String],
    exam_only: bool,
    limit: i64,
) -> Result<Vec<(f64, String)>, String> {
    use rusqlite::types::Value;
    if levels.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = levels.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let exam_clause = if exam_only {
        "AND is_exam_bank = '1'"
    } else {
        "AND is_exam_bank = '0'"
    };
    let sql = format!(
        "SELECT -bm25(curriculum_fts) AS relevance, content, title, class_level, source_type
         FROM curriculum_fts
         WHERE curriculum_fts MATCH ? AND curriculum = ? AND subject = ?
           AND class_level IN ({placeholders}) {exam_clause}
         ORDER BY rank LIMIT ?"
    );

    let mut params: Vec<Value> = vec![
        Value::Text(match_expr.to_string()),
        Value::Text(curriculum.to_string()),
        Value::Text(subject.to_string()),
    ];
    for l in levels {
        params.push(Value::Text(l.clone()));
    }
    params.push(Value::Integer(limit));

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
            let relevance: f64 = row.get(0)?;
            let content: String = row.get(1)?;
            let title: String = row.get(2)?;
            let level: String = row.get(3)?;
            let source_type: String = row.get(4)?;
            Ok((
                relevance,
                format!("[{} — {} — {}]\n{}", source_type, level, title, content),
            ))
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.flatten().collect())
}

/// Retrieve the most relevant passages from the ingested curriculum knowledge
/// (`curriculum_fts`) for the student's class. Uses `Auto` mode: standard
/// single-class retrieval for normal classes, tiered (own + prerequisite + exam
/// bank) retrieval for exam classes.
pub fn search_curriculum(
    conn: &Connection,
    query: &str,
    subject: &str,
    class_level: &str,
) -> Result<String, String> {
    search_curriculum_mode(
        conn,
        query,
        "nigerian",
        subject,
        class_level,
        RetrievalMode::Auto,
    )
}

/// Tiered curriculum retrieval. Runs one FTS5 query per active tier, scales each
/// hit's BM25 relevance by the tier weight, merges, and returns the top
/// passages — the same strategy rag/query.py verifies offline.
pub fn search_curriculum_mode(
    conn: &Connection,
    query: &str,
    curriculum: &str,
    subject: &str,
    class_level: &str,
    mode: RetrievalMode,
) -> Result<String, String> {
    const TOP_N: usize = 4;
    let match_expr = match to_fts_match(query) {
        Some(m) => m,
        None => return Ok(String::new()),
    };

    let mode = if mode == RetrievalMode::Auto {
        if is_exam_class(class_level) {
            RetrievalMode::Tiered
        } else {
            RetrievalMode::Standard
        }
    } else {
        mode
    };
    let w = mode.weights();
    let own = vec![class_level.to_lowercase()];
    let prereqs = prerequisite_levels(class_level);
    let pool = (TOP_N * 3) as i64;

    let mut scored: Vec<(f64, String)> = Vec::new();
    if w.own_class > 0.0 {
        for (rel, passage) in query_tier(conn, &match_expr, curriculum, subject, &own, false, pool)? {
            scored.push((rel * w.own_class, passage));
        }
    }
    if w.prerequisites > 0.0 && !prereqs.is_empty() {
        for (rel, passage) in
            query_tier(conn, &match_expr, curriculum, subject, &prereqs, false, pool)?
        {
            scored.push((rel * w.prerequisites, passage));
        }
    }
    if w.exam_bank > 0.0 {
        let mut all = own.clone();
        all.extend(prereqs.clone());
        for (rel, passage) in query_tier(conn, &match_expr, curriculum, subject, &all, true, pool)? {
            scored.push((rel * w.exam_bank, passage));
        }
    }

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(TOP_N);
    if scored.is_empty() {
        Ok(String::new())
    } else {
        let passages: Vec<String> = scored.into_iter().map(|(_, p)| p).collect();
        Ok(format!(
            "## Curriculum & Textbook Excerpts (ground your teaching in these)\n{}",
            passages.join("\n\n")
        ))
    }
}

#[cfg(test)]
mod fts_tests {
    use super::*;

    /// Mirror the production FTS5 schema (connection.rs / ingest.py) and seed a row.
    fn seed(conn: &Connection) {
        conn.execute_batch(
            "CREATE VIRTUAL TABLE curriculum_fts USING fts5(
                content, title UNINDEXED, curriculum UNINDEXED, subject UNINDEXED,
                class_level UNINDEXED, topic UNINDEXED, source_type UNINDEXED,
                is_exam_bank UNINDEXED, document_id UNINDEXED,
                tokenize='porter unicode61');",
        )
        .expect("FTS5 must be enabled in the bundled SQLite build");
    }

    fn insert(conn: &Connection, content: &str, title: &str, subject: &str,
              level: &str, exam_bank: &str, id: &str) {
        conn.execute(
            "INSERT INTO curriculum_fts
                (content, title, curriculum, subject, class_level, topic,
                 source_type, is_exam_bank, document_id)
             VALUES (?1, ?2, 'nigerian', ?3, ?4, 'topic', 'tutor_qa', ?5, ?6)",
            rusqlite::params![content, title, subject, level, exam_bank, id],
        )
        .unwrap();
    }

    #[test]
    fn fts5_ingest_and_retrieve_round_trips() {
        let conn = Connection::open_in_memory().unwrap();
        seed(&conn);
        insert(&conn,
            "To add fractions with different denominators, first find the lowest common multiple (LCM).",
            "JSS1 Maths", "mathematics", "jss1", "0", "doc1");

        let result = search_curriculum(&conn, "How do I add fractions?", "mathematics", "jss1")
            .unwrap();
        assert!(result.contains("lowest common multiple"), "got: {result}");
        assert!(result.contains("tutor_qa — jss1 — JSS1 Maths"));

        // Subject filter excludes non-matching subjects.
        let miss = search_curriculum(&conn, "fractions", "english", "jss1").unwrap();
        assert!(miss.is_empty());
    }

    #[test]
    fn exam_class_uses_tiered_retrieval_with_prerequisites() {
        let conn = Connection::open_in_memory().unwrap();
        seed(&conn);
        // JSS3 (exam) own content + a JSS2 prerequisite passage on the same idea.
        insert(&conn,
            "Simultaneous equations are two equations solved together for x and y.",
            "JSS3 simultaneous", "mathematics", "jss3", "0", "j3");
        insert(&conn,
            "A linear equation has the variable to the power one, like 2x plus 3.",
            "JSS2 linear", "mathematics", "jss2", "0", "j2");

        // Auto mode -> tiered for jss3: own class dominant, prerequisite present.
        let r = search_curriculum(&conn, "linear simultaneous equations", "mathematics", "jss3")
            .unwrap();
        assert!(r.contains("jss3"), "own class should appear: {r}");
        assert!(r.contains("jss2"), "prerequisite should appear: {r}");
        let own = r.find("jss3").unwrap();
        let pre = r.find("jss2").unwrap();
        assert!(own < pre, "own-class passage should rank above prerequisite: {r}");

        // A non-exam class (jss2) stays standard: never reaches into jss3.
        let std = search_curriculum(&conn, "linear simultaneous equations", "mathematics", "jss2")
            .unwrap();
        assert!(std.contains("jss2") && !std.contains("jss3"), "standard mode leaked: {std}");
    }
}

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

    // Textbook / curriculum passages from the ingested FTS5 knowledge base.
    if let Ok(excerpts) = search_curriculum(conn, query, subject, class_level) {
        if !excerpts.is_empty() {
            context_parts.push(excerpts);
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
