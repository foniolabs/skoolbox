//! LLM provider abstraction.
//!
//! Lets every call-site stay backend-agnostic: it resolves which backend to use
//! from the `model_provider` setting (default `ollama` — fully offline), then
//! dispatches to either `ollama.rs` or `claude_api.rs`.
//!
//! IMPORTANT: `resolve()` returns an owned `Provider` (owned Strings) so the
//! SQLite mutex guard is dropped *before* any `.await` — never hold the DB lock
//! across an async boundary.

use crate::ai::{claude_api, json, ollama};
use crate::db::DbState;

pub enum Provider {
    /// Local Ollama server. `model` is e.g. "qwen2.5:7b-instruct".
    Ollama { model: String },
    /// Cloud Anthropic API (fallback / online mode).
    Claude { api_key: String },
}

/// Read a single settings value, releasing the DB lock immediately.
fn get_setting(db: &DbState, key: &str) -> Option<String> {
    let conn = db.db.lock().ok()?;
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .ok()?;
    let val: String = stmt.query_row([key], |row| row.get(0)).ok()?;
    if val.is_empty() {
        None
    } else {
        Some(val)
    }
}

/// Resolve the Anthropic key: DB setting → API_KEY env → ANTHROPIC_API_KEY env.
fn resolve_claude_key(db: &DbState) -> Result<String, String> {
    if let Some(key) = get_setting(db, "claude_api_key") {
        return Ok(key);
    }
    if let Ok(key) = std::env::var("API_KEY") {
        if !key.is_empty() {
            return Ok(key);
        }
    }
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.is_empty() {
            return Ok(key);
        }
    }
    Err("No Claude API key found. Set it in Settings or switch the AI backend to Ollama (offline).".to_string())
}

/// Fallback model name if Ollama reports nothing installed (the target model).
const DEFAULT_OLLAMA_MODEL: &str = "qwen2.5:7b-instruct";

/// Decide which backend to use for this call. Defaults to offline Ollama.
///
/// Model selection order: an explicit `ollama_model` setting wins; otherwise we
/// auto-detect the best model actually installed (so a 3B works today and 7B is
/// used automatically once pulled), falling back to the target name.
///
/// `resolve` is async only for the auto-detect probe; all DB locks are dropped
/// before any `.await` (see `get_setting`).
pub async fn resolve(db: &DbState) -> Result<Provider, String> {
    let kind = get_setting(db, "model_provider").unwrap_or_else(|| "ollama".to_string());
    if kind == "claude" {
        return Ok(Provider::Claude {
            api_key: resolve_claude_key(db)?,
        });
    }

    let model = match get_setting(db, "ollama_model") {
        Some(m) => m,
        None => ollama::best_installed_model()
            .await
            .unwrap_or_else(|| DEFAULT_OLLAMA_MODEL.to_string()),
    };
    Ok(Provider::Ollama { model })
}

// ── Backend-agnostic dispatch ────────────────────────────────────────────────

/// Single-turn completion.
pub async fn complete(
    provider: &Provider,
    system_prompt: &str,
    user_message: &str,
    max_tokens: u32,
) -> Result<String, String> {
    match provider {
        Provider::Ollama { model } => {
            ollama::call_ollama(model, system_prompt, user_message, max_tokens).await
        }
        Provider::Claude { api_key } => {
            claude_api::call_claude(api_key, system_prompt, user_message, max_tokens).await
        }
    }
}

/// Multi-turn chat.
pub async fn chat(
    provider: &Provider,
    system_prompt: &str,
    messages: Vec<(String, String)>,
    max_tokens: u32,
) -> Result<String, String> {
    match provider {
        Provider::Ollama { model } => {
            ollama::call_ollama_chat(model, system_prompt, messages, max_tokens).await
        }
        Provider::Claude { api_key } => {
            claude_api::call_claude_chat(api_key, system_prompt, messages, max_tokens).await
        }
    }
}

/// Agent call (Layer 1 persona + Layer 2/3 context + conversation).
pub async fn agent(
    provider: &Provider,
    master_prompt: &str,
    context_block: &str,
    messages: Vec<(String, String)>,
    max_tokens: u32,
) -> Result<String, String> {
    match provider {
        Provider::Ollama { model } => {
            ollama::call_ollama_agent(model, master_prompt, context_block, messages, max_tokens)
                .await
        }
        Provider::Claude { api_key } => {
            claude_api::call_claude_agent(api_key, master_prompt, context_block, messages, max_tokens)
                .await
        }
    }
}

/// Generate a **valid JSON** completion (for lesson and quiz generation).
///
/// Robustness for small local models: Ollama runs in constrained JSON mode,
/// the response is stripped of fences/prose, validated by `serde_json`, and
/// retried up to 3 times. Returns clean JSON text ready to parse on the
/// frontend, or an error if the model never produced valid JSON.
pub async fn generate_json(
    provider: &Provider,
    system_prompt: &str,
    user_message: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let mut last_err = String::from("no attempts made");

    for _ in 0..2 {
        let raw = match provider {
            Provider::Ollama { model } => {
                ollama::call_ollama_json(model, system_prompt, user_message, max_tokens).await
            }
            // Claude follows "return only JSON" instructions reliably, so it
            // uses the normal path (no constrained-decoding flag exists).
            Provider::Claude { api_key } => {
                claude_api::call_claude(api_key, system_prompt, user_message, max_tokens).await
            }
        };

        match raw {
            Ok(text) => {
                let cleaned = json::extract_json(&text);
                if json::is_valid(&cleaned) {
                    return Ok(cleaned);
                }
                last_err = "model returned text that was not valid JSON".to_string();
            }
            Err(e) => last_err = e,
        }
    }

    Err(format!(
        "The AI could not produce valid JSON ({}). Try a more capable model (e.g. qwen2.5:7b-instruct).",
        last_err
    ))
}

/// Conversation summary for memory compression.
pub async fn summarize(provider: &Provider, conversation_text: &str) -> Result<String, String> {
    match provider {
        Provider::Ollama { model } => ollama::generate_summary(model, conversation_text).await,
        Provider::Claude { api_key } => {
            claude_api::generate_summary(api_key, conversation_text).await
        }
    }
}
