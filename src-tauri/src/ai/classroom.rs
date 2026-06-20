//! Classroom Engine — Martha leads a class (AI_ENGINE plan, "Module 1").
//!
//! First slice of the classroom flow:
//!   Start lesson → Introduction + Teaching segment + a checking Question
//!   → (student answers) → Evaluate + Remediate
//!
//! Everything runs on the active provider (offline Qwen by default) in
//! constrained-JSON mode, grounded in retrieved curriculum, and speaks in
//! Martha's voice. State is driven from the frontend for now; future slices add
//! pacing, participation tracking, and the full assessment/report phases.

use crate::ai::martha;
use crate::ai::provider::{self, Provider};
use serde::{Deserialize, Serialize};

/// The opening of a class: how Martha introduces and teaches the topic, plus a
/// question to check the class's understanding.
#[derive(Debug, Serialize, Deserialize)]
pub struct LessonSegment {
    /// Martha greets the class and introduces the topic (spoken aloud).
    pub introduction: String,
    /// Step-by-step teaching points, in order, each a short spoken explanation.
    pub teaching_points: Vec<String>,
    /// A single question to check whether the class understood.
    pub check_question: String,
}

/// A ~30-minute lesson broken into short teaching segments (taught one at a
/// time so a small model handles it well and the class fills the period).
#[derive(Debug, Serialize, Deserialize)]
pub struct LessonPlan {
    pub title: String,
    /// 8–10 short segment titles, building from basics to practice.
    pub segment_titles: Vec<String>,
}

/// One thing Martha writes on the whiteboard while saying it aloud.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BoardStep {
    /// write | equation | highlight | heading | diagram
    pub action: String,
    /// What appears on the board (short).
    pub content: String,
    /// What Martha says while writing it.
    pub narration: String,
}

/// A taught segment: a few board steps + a question to check understanding.
#[derive(Debug, Serialize, Deserialize)]
pub struct TeachingSegment {
    pub board_steps: Vec<BoardStep>,
    pub check_question: String,
}

/// A fully pre-generated segment (board steps + question) ready to play.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeneratedSegment {
    pub title: String,
    pub board_steps: Vec<BoardStep>,
    pub check_question: String,
}

/// A complete pre-generated ("baked") lesson — produced once, played anywhere.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeneratedLesson {
    pub subject: String,
    pub class_level: String,
    pub topic: String,
    pub title: String,
    pub segments: Vec<GeneratedSegment>,
}

/// Bake a whole lesson: plan it, then generate every segment. SLOW (it's the
/// full live flow run end-to-end) — run once on capable hardware, then ship the
/// result so schools play it instantly.
pub async fn bake_lesson(
    prov: &Provider,
    subject: &str,
    topic: &str,
    class_level: &str,
    curriculum_context: &str,
) -> Result<GeneratedLesson, String> {
    let plan = plan_lesson(prov, subject, topic, class_level, curriculum_context).await?;
    let total = plan.segment_titles.len();
    let mut segments = Vec::with_capacity(total);
    for (i, title) in plan.segment_titles.iter().enumerate() {
        let seg = teach_segment(
            prov, subject, topic, class_level, title, i + 1, total, curriculum_context,
        )
        .await?;
        segments.push(GeneratedSegment {
            title: title.clone(),
            board_steps: seg.board_steps,
            check_question: seg.check_question,
        });
    }
    Ok(GeneratedLesson {
        subject: subject.to_string(),
        class_level: class_level.to_string(),
        topic: topic.to_string(),
        title: plan.title,
        segments,
    })
}

/// Martha's judgement of a student's spoken/typed answer.
#[derive(Debug, Serialize, Deserialize)]
pub struct AnswerEvaluation {
    pub is_correct: bool,
    /// Warm, encouraging feedback addressed to the student.
    pub feedback: String,
    /// If the answer was wrong, a different-angle re-explanation; else null.
    pub remediation: Option<String>,
}

/// Begin a lesson: introduce the topic, teach it in steps, end with a question.
pub async fn start_lesson(
    prov: &Provider,
    subject: &str,
    topic: &str,
    class_level: &str,
    curriculum_context: &str,
) -> Result<LessonSegment, String> {
    let system = format!(
        "{}\n\n## CLASSROOM MODE\nYou are now LEADING A LIVE CLASS on a big screen, not chatting one-on-one. \
        Speak to the whole class warmly. Teach in small, clear steps suitable for {class_level}. \
        Use Nigerian examples (Naira, local names, everyday life). End by asking ONE question to check understanding.",
        martha::persona()
    );

    let context = if curriculum_context.trim().is_empty() {
        String::new()
    } else {
        format!("\n\nRelevant curriculum to teach from:\n{curriculum_context}")
    };

    let user = format!(
        "Subject: {subject}\nClass: {class_level}\nTopic: {topic}{context}\n\n\
        Return ONLY a JSON object with exactly these keys:\n\
        {{\n  \"introduction\": \"<greet the class and introduce the topic>\",\n  \
        \"teaching_points\": [\"<step 1>\", \"<step 2>\", \"...\"],\n  \
        \"check_question\": \"<one question to check understanding>\"\n}}"
    );

    let raw = provider::generate_json(prov, &system, &user, 700).await?;
    serde_json::from_str::<LessonSegment>(&raw)
        .map_err(|e| format!("Could not understand the lesson Martha generated: {e}"))
}

/// Plan a full ~30-minute lesson as 8–10 short segments.
pub async fn plan_lesson(
    prov: &Provider,
    subject: &str,
    topic: &str,
    class_level: &str,
    curriculum_context: &str,
) -> Result<LessonPlan, String> {
    let system = format!(
        "{}\n\n## CLASSROOM MODE — LESSON PLANNING\nYou are planning a full ~30-minute class \
        for {class_level} (a normal Nigerian school period). Break the topic into 8 to 10 SHORT \
        teaching segments (~3 minutes each) that build on each other: start from the basics, \
        work through clear examples, then practice. Each segment title is a few words.",
        martha::persona()
    );
    let context = if curriculum_context.trim().is_empty() {
        String::new()
    } else {
        format!("\n\nCurriculum to cover:\n{curriculum_context}")
    };
    let user = format!(
        "Subject: {subject}\nClass: {class_level}\nTopic: {topic}{context}\n\n\
        Return ONLY JSON: {{ \"title\": \"<lesson title>\", \"segment_titles\": [\"<segment 1>\", \"...\"] }} \
        with 8 to 10 segment titles."
    );
    let raw = provider::generate_json(prov, &system, &user, 350).await?;
    serde_json::from_str::<LessonPlan>(&raw)
        .map_err(|e| format!("Could not understand the lesson plan: {e}"))
}

/// Teach one segment: produce whiteboard steps (written + narrated) and a
/// checking question. `index`/`total` are 1-based for Martha's awareness.
pub async fn teach_segment(
    prov: &Provider,
    subject: &str,
    topic: &str,
    class_level: &str,
    segment_title: &str,
    index: usize,
    total: usize,
    curriculum_context: &str,
) -> Result<TeachingSegment, String> {
    let system = format!(
        "{}\n\n## CLASSROOM MODE — TEACHING ON A WHITEBOARD\nYou are teaching segment {index} of \
        {total} of a live class for {class_level}. Write on the whiteboard AND say each line aloud. \
        For maths and sciences, SHOW THE WORKING line by line (one equation per step). Keep what's \
        written SHORT; put the full explanation in the narration. Use Nigerian examples. \
        Finish with ONE short question to check the class understood this segment.",
        martha::persona()
    );
    let context = if curriculum_context.trim().is_empty() {
        String::new()
    } else {
        format!("\n\nCurriculum reference:\n{curriculum_context}")
    };
    let user = format!(
        "Subject: {subject}\nClass: {class_level}\nTopic: {topic}\nThis segment: {segment_title}{context}\n\n\
        Return ONLY JSON:\n{{\n  \"board_steps\": [\n    {{ \"action\": \"<ONE of: heading, write, equation, highlight, diagram>\", \
        \"content\": \"<short text on the board>\", \"narration\": \"<what you say>\" }}\n  ],\n  \
        \"check_question\": \"<one question>\"\n}}\n\
        Rules: pick exactly ONE action per step (never \"write|equation\"). \
        Use action \"equation\" for any maths, and write the maths as plain LaTeX WITHOUT \\( \\) or $ delimiters \
        (e.g. content: \"\\\\frac{{2}}{{5}} + \\\\frac{{3}}{{5}} = \\\\frac{{5}}{{5}}\"). \
        Use 3 to 6 board_steps."
    );
    let raw = provider::generate_json(prov, &system, &user, 700).await?;
    serde_json::from_str::<TeachingSegment>(&raw)
        .map_err(|e| format!("Could not understand the teaching segment: {e}"))
}

/// Evaluate a student's answer to the checking question and remediate if wrong.
pub async fn evaluate_answer(
    prov: &Provider,
    subject: &str,
    topic: &str,
    question: &str,
    student_answer: &str,
) -> Result<AnswerEvaluation, String> {
    let system = format!(
        "{}\n\n## CLASSROOM MODE — EVALUATION\nYou asked the class a question and a student answered. \
        Judge fairly and kindly. If wrong, NEVER just give the answer — re-teach with a different, \
        simpler approach so they can get there themselves.",
        martha::persona()
    );

    let user = format!(
        "Subject: {subject}\nTopic: {topic}\nQuestion you asked: {question}\nStudent's answer: {student_answer}\n\n\
        Return ONLY a JSON object with exactly these keys:\n\
        {{\n  \"is_correct\": <true|false>,\n  \
        \"feedback\": \"<warm feedback to the student>\",\n  \
        \"remediation\": <\"<a different, simpler explanation>\" if wrong, otherwise null>\n}}"
    );

    let raw = provider::generate_json(prov, &system, &user, 400).await?;
    serde_json::from_str::<AnswerEvaluation>(&raw)
        .map_err(|e| format!("Could not understand Martha's evaluation: {e}"))
}
