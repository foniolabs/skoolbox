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
#[allow(clippy::too_many_arguments)] // mirrors the JS invoke() args
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

/// A teacher-facing lesson note: the printable artifact a Nigerian teacher
/// prepares before class (objectives → key points → examples → homework).
#[derive(Debug, Serialize, Deserialize)]
pub struct LessonNote {
    pub title: String,
    pub objectives: Vec<String>,
    pub key_points: Vec<String>,
    pub examples: Vec<String>,
    pub homework: Vec<String>,
}

/// Generate a lesson note for the teacher to review, edit and approve.
pub async fn generate_lesson_note(
    prov: &Provider,
    subject: &str,
    topic: &str,
    class_level: &str,
    curriculum_context: &str,
) -> Result<LessonNote, String> {
    let system = format!(
        "{}\n\n## CLASSROOM MODE — LESSON NOTE\nYou are preparing a written lesson note for a \
        {class_level} teacher, in the standard Nigerian format. Be concrete and curriculum-aligned: \
        clear objectives (what pupils will be able to do), the key points in teaching order, worked \
        examples with Nigerian context (Naira, local names), and homework the pupils can do without help.",
        martha::persona()
    );
    let context = if curriculum_context.trim().is_empty() {
        String::new()
    } else {
        format!("\n\nCurriculum to draw from:\n{curriculum_context}")
    };
    let user = format!(
        "Subject: {subject}\nClass: {class_level}\nTopic: {topic}{context}\n\n\
        Return ONLY JSON:\n{{\n  \"title\": \"<lesson note title>\",\n  \
        \"objectives\": [\"<objective 1>\", \"...\"],\n  \
        \"key_points\": [\"<point 1 in teaching order>\", \"...\"],\n  \
        \"examples\": [\"<worked example 1>\", \"...\"],\n  \
        \"homework\": [\"<homework question 1>\", \"...\"]\n}}\n\
        Use 3-4 objectives, 4-6 key points, 2-3 examples and 3-5 homework questions."
    );
    let raw = provider::generate_json(prov, &system, &user, 900).await?;
    serde_json::from_str::<LessonNote>(&raw)
        .map_err(|e| format!("Could not understand the lesson note Martha generated: {e}"))
}

/// One quiz question shown on the projector (Martha reads it aloud).
#[derive(Debug, Serialize, Deserialize)]
pub struct ClassQuizQuestion {
    pub question: String,
    pub answer: String,
}

/// A short on-demand class quiz (3–5 questions with answers for the teacher).
#[derive(Debug, Serialize, Deserialize)]
pub struct ClassQuiz {
    pub title: String,
    pub questions: Vec<ClassQuizQuestion>,
}

/// Generate a 3–5 question quiz on the topic for Martha to run with the class.
pub async fn generate_class_quiz(
    prov: &Provider,
    subject: &str,
    topic: &str,
    class_level: &str,
    curriculum_context: &str,
) -> Result<ClassQuiz, String> {
    let system = format!(
        "{}\n\n## CLASSROOM MODE — CLASS QUIZ\nYou are quizzing a live {class_level} class. \
        Write clear, level-appropriate questions in WAEC/NECO style for exam classes and simple \
        direct style for lower classes. Each question must be answerable from the topic taught, \
        with Nigerian context where natural. Provide the correct answer (with brief working for \
        maths) so the teacher can mark.",
        martha::persona()
    );
    let context = if curriculum_context.trim().is_empty() {
        String::new()
    } else {
        format!("\n\nCurriculum reference:\n{curriculum_context}")
    };
    let user = format!(
        "Subject: {subject}\nClass: {class_level}\nTopic: {topic}{context}\n\n\
        Return ONLY JSON:\n{{\n  \"title\": \"<quiz title>\",\n  \
        \"questions\": [\n    {{ \"question\": \"<question text>\", \"answer\": \"<correct answer, with working for maths>\" }}\n  ]\n}}\n\
        Use 3 to 5 questions, ordered easiest first."
    );
    let raw = provider::generate_json(prov, &system, &user, 800).await?;
    serde_json::from_str::<ClassQuiz>(&raw)
        .map_err(|e| format!("Could not understand the quiz Martha generated: {e}"))
}

/// On-demand teacher commands that return one spoken/displayed explanation.
/// `mode`: "class" (explain to everyone), "simpler" (re-explain for a named
/// student who didn't get it), "prerequisites" (what the class must already know).
pub async fn explain(
    prov: &Provider,
    subject: &str,
    topic: &str,
    class_level: &str,
    mode: &str,
    student_name: Option<&str>,
    curriculum_context: &str,
) -> Result<String, String> {
    let instruction = match mode {
        "simpler" => {
            let name = student_name.unwrap_or("one of the students");
            format!(
                "{name} did not understand the explanation. Re-explain the idea to {name} from a \
                completely different angle: simpler words, a very concrete everyday Nigerian example, \
                shorter sentences. Address {name} warmly by name, then carry the whole class along."
            )
        }
        "prerequisites" => "List and briefly re-teach the things the class must already know before \
            this topic (the prerequisites), in order, each with a one-line reminder of how it works."
            .to_string(),
        _ => "Explain this topic to the whole class clearly and step by step, as if teaching it \
            fresh: what it is, why it matters in everyday Nigerian life, and one worked example."
            .to_string(),
    };
    let system = format!(
        "{}\n\n## CLASSROOM MODE — ON-DEMAND EXPLANATION\nYou are speaking live to a {class_level} \
        class on a projector. {instruction} Keep it under 200 words — it is spoken aloud.",
        martha::persona()
    );
    let context = if curriculum_context.trim().is_empty() {
        String::new()
    } else {
        format!("\n\nCurriculum reference:\n{curriculum_context}")
    };
    let user = format!("Subject: {subject}\nClass: {class_level}\nTopic: {topic}{context}");
    provider::complete(prov, &system, &user, 500).await
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
