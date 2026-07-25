//! Curriculum / textbook ingestion commands — the "feed Martha the curriculum"
//! pipeline.
//!
//! Flow: the frontend extracts plain text from an upload (the app already ships
//! `mammoth` for .docx; .txt is read directly; paste works too) and calls
//! `ingest_curriculum_text`. The text is chunked and written into the FTS5
//! index, after which Martha retrieves from it automatically at question time
//! (see `ai::rag::search_curriculum`).

use crate::ai::chunking;
use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Serialize)]
pub struct IngestResult {
    pub document_id: String,
    pub chunks: usize,
}

#[derive(Serialize)]
pub struct CurriculumDocument {
    pub id: String,
    pub title: String,
    pub subject: Option<String>,
    pub class_level: Option<String>,
    pub source_type: String,
    pub chunk_count: i64,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct CurriculumStats {
    pub documents: i64,
    pub chunks: i64,
}

/// Ingest a curriculum document: chunk it and index every chunk for retrieval.
///
/// `source_type` is one of: textbook | curriculum | past_questions | lesson_notes.
#[tauri::command]
pub async fn ingest_curriculum_text(
    db: State<'_, DbState>,
    title: String,
    subject: String,
    class_level: String,
    source_type: String,
    content: String,
) -> Result<IngestResult, String> {
    let chunks = chunking::chunk_text(&content);
    if chunks.is_empty() {
        return Err("Document is empty after parsing — nothing to ingest.".to_string());
    }

    let document_id = Uuid::new_v4().to_string();
    let n = chunks.len();

    let mut conn = db.db.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO curriculum_documents
            (id, title, subject, class_level, source_type, chunk_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![document_id, title, subject, class_level, source_type, n as i64],
    )
    .map_err(|e| e.to_string())?;

    for chunk in &chunks {
        tx.execute(
            "INSERT INTO curriculum_fts
                (content, title, subject, class_level, source_type, document_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![chunk, title, subject, class_level, source_type, document_id],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(IngestResult {
        document_id,
        chunks: n,
    })
}

/// List ingested curriculum documents (newest first) for a management screen.
#[tauri::command]
pub async fn list_curriculum_documents(
    db: State<'_, DbState>,
) -> Result<Vec<CurriculumDocument>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, subject, class_level, source_type, chunk_count, created_at
             FROM curriculum_documents
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(CurriculumDocument {
                id: row.get(0)?,
                title: row.get(1)?,
                subject: row.get(2)?,
                class_level: row.get(3)?,
                source_type: row.get(4)?,
                chunk_count: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Delete a document and all its indexed chunks.
#[tauri::command]
pub async fn delete_curriculum_document(
    db: State<'_, DbState>,
    document_id: String,
) -> Result<(), String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM curriculum_fts WHERE document_id = ?1",
        rusqlite::params![document_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM curriculum_documents WHERE id = ?1",
        rusqlite::params![document_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Curriculum Packs (producer authoring → school patch updates) ─────────────
//
// A pack is a single portable file bundling all curriculum documents + their
// indexed chunks. Producers author content, export a versioned pack, and ship
// it (pre-installed with the app, or as an update file). Schools import it to
// get the latest curriculum — fully offline, no server required.

const PACK_FORMAT_VERSION: u32 = 1;

#[derive(Serialize, Deserialize)]
pub struct PackDocument {
    pub title: String,
    pub subject: Option<String>,
    pub class_level: Option<String>,
    pub source_type: String,
    pub chunks: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CurriculumPack {
    pub skoolbox_pack_version: u32,
    pub name: String,
    pub version: String,
    pub created_at: String,
    pub documents: Vec<PackDocument>,
    /// Pre-generated lessons baked into the pack for instant playback.
    /// Optional so older v1 packs (curriculum text only) still load.
    #[serde(default)]
    pub lessons: Vec<crate::ai::classroom::GeneratedLesson>,
}

#[derive(Serialize)]
pub struct ImportSummary {
    pub documents: usize,
    pub chunks: usize,
    pub lessons: usize,
    pub replaced: bool,
}

/// One `curriculum_documents` row: (id, title, subject, class_level, source_type).
type DocRow = (String, String, Option<String>, Option<String>, String);

/// Build a `CurriculumPack` from everything currently in the knowledge base.
fn build_pack(conn: &rusqlite::Connection, name: &str, version: &str) -> Result<CurriculumPack, String> {
    let mut doc_stmt = conn
        .prepare("SELECT id, title, subject, class_level, source_type FROM curriculum_documents ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let docs: Vec<DocRow> = doc_stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut documents = Vec::with_capacity(docs.len());
    for (id, title, subject, class_level, source_type) in docs {
        let mut chunk_stmt = conn
            .prepare("SELECT content FROM curriculum_fts WHERE document_id = ?1")
            .map_err(|e| e.to_string())?;
        let chunks: Vec<String> = chunk_stmt
            .query_map([&id], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        documents.push(PackDocument { title, subject, class_level, source_type, chunks });
    }

    // Pre-generated lessons (stored as JSON in generated_lessons).
    let mut lesson_stmt = conn
        .prepare("SELECT content FROM generated_lessons")
        .map_err(|e| e.to_string())?;
    let lessons: Vec<crate::ai::classroom::GeneratedLesson> = lesson_stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .filter_map(|json| serde_json::from_str(&json).ok())
        .collect();

    Ok(CurriculumPack {
        skoolbox_pack_version: PACK_FORMAT_VERSION,
        name: name.to_string(),
        version: version.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        documents,
        lessons,
    })
}

/// Insert a pack's documents + chunks. If `replace`, wipe existing curriculum
/// first (a clean "patch" so schools mirror the producer exactly).
fn apply_pack(conn: &rusqlite::Connection, pack: &CurriculumPack, replace: bool) -> Result<ImportSummary, String> {
    if replace {
        conn.execute("DELETE FROM curriculum_fts", []).map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM curriculum_documents", []).map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM generated_lessons", []).map_err(|e| e.to_string())?;
    }

    // Pre-generated lessons (upsert by subject+class+topic).
    for lesson in &pack.lessons {
        let content = serde_json::to_string(lesson).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO generated_lessons (id, subject, class_level, topic, title, content)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(subject, class_level, topic)
             DO UPDATE SET title = ?5, content = ?6, created_at = datetime('now')",
            rusqlite::params![Uuid::new_v4().to_string(), lesson.subject, lesson.class_level, lesson.topic, lesson.title, content],
        )
        .map_err(|e| e.to_string())?;
    }

    let mut total_chunks = 0usize;
    for doc in &pack.documents {
        let document_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO curriculum_documents (id, title, subject, class_level, source_type, chunk_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![document_id, doc.title, doc.subject, doc.class_level, doc.source_type, doc.chunks.len() as i64],
        ).map_err(|e| e.to_string())?;
        for chunk in &doc.chunks {
            conn.execute(
                "INSERT INTO curriculum_fts (content, title, subject, class_level, source_type, document_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![chunk, doc.title, doc.subject, doc.class_level, doc.source_type, document_id],
            ).map_err(|e| e.to_string())?;
            total_chunks += 1;
        }
    }
    Ok(ImportSummary { documents: pack.documents.len(), chunks: total_chunks, lessons: pack.lessons.len(), replaced: replace })
}

/// First-run seeding: import a bundled pack only if the knowledge base is empty.
/// Lets a shipped default curriculum be available out of the box (pre-installed).
pub fn seed_pack_if_empty(conn: &rusqlite::Connection, pack_json: &str) -> Result<ImportSummary, String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM curriculum_documents", [], |r| r.get(0))
        .unwrap_or(0);
    if count > 0 {
        return Ok(ImportSummary { documents: 0, chunks: 0, lessons: 0, replaced: false });
    }
    let pack: CurriculumPack =
        serde_json::from_str(pack_json).map_err(|e| format!("Invalid bundled pack: {e}"))?;
    apply_pack(conn, &pack, false)
}

/// Export the whole knowledge base as a pack file (producer side) and return the
/// path it was written to. Producers distribute this file / bundle it with the
/// app as `default_curriculum_pack.json`.
#[tauri::command]
pub async fn export_curriculum_pack(
    db: State<'_, DbState>,
    name: String,
    version: String,
) -> Result<String, String> {
    let json = {
        let conn = db.db.lock().map_err(|e| e.to_string())?;
        let pack = build_pack(&conn, &name, &version)?;
        serde_json::to_string_pretty(&pack).map_err(|e| e.to_string())?
    };

    let home = std::env::var("HOME").map_err(|_| "Could not locate the home directory.".to_string())?;
    let dir = std::path::PathBuf::from(home).join(".local/share/com.foniolabs.skoolbox/packs");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();
    let path = dir.join(format!("{safe}-{version}.json"));
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Import a pack JSON string (school side — the "patch update").
#[tauri::command]
pub async fn import_curriculum_pack(
    db: State<'_, DbState>,
    pack_json: String,
    replace: bool,
) -> Result<ImportSummary, String> {
    let pack: CurriculumPack = serde_json::from_str(&pack_json)
        .map_err(|e| format!("Not a valid SkoolBox curriculum pack: {e}"))?;
    if pack.skoolbox_pack_version > PACK_FORMAT_VERSION {
        return Err("This pack needs a newer version of SkoolBox. Please update the app.".to_string());
    }
    let mut conn = db.db.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let summary = apply_pack(&tx, &pack, replace)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(summary)
}

/// Quick counts for a dashboard ("Martha knows N documents / M passages").
#[tauri::command]
pub async fn curriculum_stats(db: State<'_, DbState>) -> Result<CurriculumStats, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let documents: i64 = conn
        .query_row("SELECT COUNT(*) FROM curriculum_documents", [], |r| r.get(0))
        .unwrap_or(0);
    let chunks: i64 = conn
        .query_row("SELECT COUNT(*) FROM curriculum_fts", [], |r| r.get(0))
        .unwrap_or(0);
    Ok(CurriculumStats { documents, chunks })
}
