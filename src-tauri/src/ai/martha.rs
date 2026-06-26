//! Martha — the Tutor brain.
//!
//! A thin, plan-aligned facade over Martha's persona + the active LLM provider
//! (AI_ENGINE plan, "Module 5 — Tutor Engine"). The heavy orchestration
//! (DB context, memory, RAG) lives in `commands::agent`; this module is the one
//! place that defines "what a Martha turn is" so both the tutor and the
//! classroom engine share the same voice.

use crate::ai::{agent_prompt, provider};
use crate::ai::provider::Provider;

/// Martha's master persona — the 20-year NERDC Nigerian-teacher system prompt.
/// Single source of truth (re-exported so callers depend on `martha`, not the
/// raw prompt file).
pub fn persona() -> &'static str {
    agent_prompt::master_system_prompt()
}

/// One tutoring turn: persona (Layer 1) + dynamic context — curriculum + student
/// memory (Layers 2/3) + conversation history → Martha's reply, on whatever
/// backend is active (offline Ollama by default).
pub async fn tutor_reply(
    prov: &Provider,
    context_block: &str,
    history: Vec<(String, String)>,
    max_tokens: u32,
) -> Result<String, String> {
    provider::agent(prov, persona(), context_block, history, max_tokens).await
}
