//! Offline LLM backend — talks to a local Ollama server (default: Qwen 2.5).
//!
//! Mirrors the function shapes in `claude_api.rs` so the two backends are
//! interchangeable behind `provider.rs`. No internet required: everything goes
//! to `http://localhost:11434` (override with the `OLLAMA_HOST` env var).

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OllamaMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    /// Lower = more consistent, less hallucination. Teaching wants ~0.4.
    temperature: f32,
    /// Context window — room for curriculum context + chat history.
    num_ctx: u32,
    /// Max tokens to generate (Ollama's name for max_tokens).
    num_predict: u32,
}

#[derive(Debug, Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
    options: OllamaOptions,
    /// When `Some("json")`, Ollama constrains decoding to syntactically valid
    /// JSON — the key reliability fix for lesson/quiz generation on small models.
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<String>,
    /// Keep the model resident in memory between requests so the next
    /// generation doesn't pay the cold-load cost — big perceived-speed win
    /// when teaching back-to-back.
    keep_alive: String,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    message: OllamaMessage,
}

/// Base URL of the Ollama server. Override with `OLLAMA_HOST`.
fn host() -> String {
    std::env::var("OLLAMA_HOST").unwrap_or_else(|_| "http://localhost:11434".to_string())
}

/// Core POST to `/api/chat`. All public helpers funnel through here.
/// `json_mode` constrains the output to valid JSON when true.
async fn post_chat(
    model: &str,
    messages: Vec<OllamaMessage>,
    max_tokens: u32,
    json_mode: bool,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        // CPU generation of a full lesson can be slow — allow up to 5 min so a
        // slow-but-valid response isn't cut off and forced to a generic fallback.
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let request = OllamaChatRequest {
        model: model.to_string(),
        messages,
        stream: false,
        options: OllamaOptions {
            temperature: 0.4,
            num_ctx: 4096,
            num_predict: max_tokens,
        },
        format: if json_mode {
            Some("json".to_string())
        } else {
            None
        },
        keep_alive: "30m".to_string(),
    };

    let response = client
        .post(format!("{}/api/chat", host()))
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            format!(
                "Could not reach Ollama at {} — is `ollama serve` running? ({})",
                host(),
                e
            )
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".to_string());
        return Err(format!("Ollama error {}: {}", status, body));
    }

    let parsed: OllamaChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    Ok(parsed.message.content)
}

/// Single-turn call (mirrors `claude_api::call_claude`).
pub async fn call_ollama(
    model: &str,
    system_prompt: &str,
    user_message: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let messages = vec![
        OllamaMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        OllamaMessage {
            role: "user".to_string(),
            content: user_message.to_string(),
        },
    ];
    post_chat(model, messages, max_tokens, false).await
}

/// Single-turn call in JSON-constrained mode (mirrors `call_ollama` but forces
/// valid JSON output). Used for lesson and quiz generation.
pub async fn call_ollama_json(
    model: &str,
    system_prompt: &str,
    user_message: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let messages = vec![
        OllamaMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        OllamaMessage {
            role: "user".to_string(),
            content: user_message.to_string(),
        },
    ];
    post_chat(model, messages, max_tokens, true).await
}

/// Multi-turn call (mirrors `claude_api::call_claude_chat`).
pub async fn call_ollama_chat(
    model: &str,
    system_prompt: &str,
    messages: Vec<(String, String)>,
    max_tokens: u32,
) -> Result<String, String> {
    let mut msgs = vec![OllamaMessage {
        role: "system".to_string(),
        content: system_prompt.to_string(),
    }];
    msgs.extend(
        messages
            .into_iter()
            .map(|(role, content)| OllamaMessage { role, content }),
    );
    post_chat(model, msgs, max_tokens, false).await
}

/// Agent call (mirrors `claude_api::call_claude_agent`).
///
/// Ollama has no prompt caching, so Layer 1 (master persona) and Layer 2+3
/// (curriculum + student context) are simply concatenated into one system
/// message.
pub async fn call_ollama_agent(
    model: &str,
    master_prompt: &str,
    context_block: &str,
    messages: Vec<(String, String)>,
    max_tokens: u32,
) -> Result<String, String> {
    let system = format!("{}\n\n{}", master_prompt, context_block);
    call_ollama_chat(model, &system, messages, max_tokens).await
}

/// Conversation summary for memory compression (mirrors `claude_api::generate_summary`).
pub async fn generate_summary(model: &str, conversation_text: &str) -> Result<String, String> {
    let system = "You are a teaching assistant that summarizes tutoring conversations.";
    let prompt = format!(
        "Summarize this tutoring conversation in 2-3 concise sentences. \
        Focus on: what topic was discussed, what the student struggled with, \
        what teaching approach worked, and what to try next time if the student returns.\n\n\
        Conversation:\n{}",
        conversation_text
    );
    call_ollama(model, system, &prompt, 300).await
}

#[derive(Debug, Deserialize)]
struct TagsResponse {
    models: Vec<TagModel>,
}

#[derive(Debug, Deserialize)]
struct TagModel {
    name: String,
}

/// Pick the best model that is actually installed in Ollama.
///
/// Preference: an instruct-tuned 7B → any 7B → any Qwen → the first model.
/// This lets the app run on whatever is present (e.g. a 3B today) and silently
/// upgrade to 7B once it has been pulled, with no configuration change.
pub async fn best_installed_model() -> Option<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .ok()?;
    let resp = client.get(format!("{}/api/tags", host())).send().await.ok()?;
    let tags: TagsResponse = resp.json().await.ok()?;
    let names: Vec<String> = tags.models.into_iter().map(|m| m.name).collect();
    if names.is_empty() {
        return None;
    }

    let pick = |pred: &dyn Fn(&str) -> bool| names.iter().find(|n| pred(&n.to_lowercase())).cloned();

    // The bundled/seeded model (see ai::runtime::BUNDLED_MODEL) wins — it's the
    // curriculum-tuned build shipped in the installer.
    pick(&|n| n.contains(crate::ai::runtime::BUNDLED_MODEL))
        .or_else(|| pick(&|n| n.contains("7b") && n.contains("instruct")))
        .or_else(|| pick(&|n| n.contains("7b")))
        .or_else(|| pick(&|n| n.contains("qwen")))
        .or_else(|| names.first().cloned())
}

/// Health check: is the Ollama server reachable?
pub async fn is_available() -> bool {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };
    client
        .get(format!("{}/api/tags", host()))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}
