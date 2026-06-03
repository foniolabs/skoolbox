use serde::{Deserialize, Serialize};

// ── Standard (non-cached) request types ──────────────────────────────────────

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<ClaudeMessage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContent {
    text: String,
}

// ── Cached request types (for agent system with prompt caching) ───────────────

/// A block in the system array for cached requests.
#[derive(Debug, Serialize)]
struct SystemBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    cache_control: Option<CacheControl>,
}

#[derive(Debug, Serialize)]
struct CacheControl {
    #[serde(rename = "type")]
    control_type: String,
}

#[derive(Debug, Serialize)]
struct CachedClaudeRequest {
    model: String,
    max_tokens: u32,
    system: Vec<SystemBlock>,
    messages: Vec<ClaudeMessage>,
}

// ── Standard single-turn call ─────────────────────────────────────────────────

/// Call the Anthropic Claude API with a system prompt and user message.
/// Returns the raw text response.
pub async fn call_claude(
    api_key: &str,
    system_prompt: &str,
    user_message: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let request = ClaudeRequest {
        model: "claude-sonnet-4-20250514".to_string(),
        max_tokens,
        system: system_prompt.to_string(),
        messages: vec![ClaudeMessage {
            role: "user".to_string(),
            content: user_message.to_string(),
        }],
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to call Claude API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".to_string());
        return Err(format!("Claude API error {}: {}", status, body));
    }

    let claude_response: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Claude response: {}", e))?;

    claude_response
        .content
        .first()
        .map(|c| c.text.clone())
        .ok_or_else(|| "Empty response from Claude".to_string())
}

// ── Standard multi-turn call ──────────────────────────────────────────────────

/// Call Claude with multi-turn conversation history.
pub async fn call_claude_chat(
    api_key: &str,
    system_prompt: &str,
    messages: Vec<(String, String)>, // (role, content) pairs
    max_tokens: u32,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let claude_messages: Vec<ClaudeMessage> = messages
        .into_iter()
        .map(|(role, content)| ClaudeMessage { role, content })
        .collect();

    let request = ClaudeRequest {
        model: "claude-sonnet-4-20250514".to_string(),
        max_tokens,
        system: system_prompt.to_string(),
        messages: claude_messages,
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to call Claude API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".to_string());
        return Err(format!("Claude API error {}: {}", status, body));
    }

    let claude_response: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Claude response: {}", e))?;

    claude_response
        .content
        .first()
        .map(|c| c.text.clone())
        .ok_or_else(|| "Empty response from Claude".to_string())
}

// ── Agent call with prompt caching ───────────────────────────────────────────

/// Call Claude for the AI agent system using prompt caching.
///
/// Layer 1 (master system prompt) is marked with `cache_control: ephemeral`
/// so Anthropic caches it across calls — 90% cost reduction on that block.
///
/// Layer 2+3 (curriculum context + student context) are passed uncached
/// as they change per request.
///
/// Requires the `anthropic-beta: prompt-caching-2024-07-31` header.
pub async fn call_claude_agent(
    api_key: &str,
    master_prompt: &str,         // Layer 1: cached identity/personality
    context_block: &str,         // Layer 2+3: curriculum + student context
    messages: Vec<(String, String)>,
    max_tokens: u32,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let claude_messages: Vec<ClaudeMessage> = messages
        .into_iter()
        .map(|(role, content)| ClaudeMessage { role, content })
        .collect();

    let system_blocks = vec![
        // Layer 1: Master system prompt — CACHED
        SystemBlock {
            block_type: "text".to_string(),
            text: master_prompt.to_string(),
            cache_control: Some(CacheControl {
                control_type: "ephemeral".to_string(),
            }),
        },
        // Layer 2+3: Curriculum context + student memory — NOT cached (dynamic per call)
        SystemBlock {
            block_type: "text".to_string(),
            text: context_block.to_string(),
            cache_control: None,
        },
    ];

    let request = CachedClaudeRequest {
        model: "claude-sonnet-4-20250514".to_string(),
        max_tokens,
        system: system_blocks,
        messages: claude_messages,
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("anthropic-beta", "prompt-caching-2024-07-31")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to call Claude API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".to_string());
        return Err(format!("Claude API error {}: {}", status, body));
    }

    let claude_response: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Claude response: {}", e))?;

    claude_response
        .content
        .first()
        .map(|c| c.text.clone())
        .ok_or_else(|| "Empty response from Claude".to_string())
}

/// Generate a conversation summary using Claude (used for memory compression).
pub async fn generate_summary(
    api_key: &str,
    conversation_text: &str,
) -> Result<String, String> {
    let system = "You are a teaching assistant that summarizes tutoring conversations.";
    let prompt = format!(
        "Summarize this tutoring conversation in 2-3 concise sentences. \
        Focus on: what topic was discussed, what the student struggled with, \
        what teaching approach worked, and what to try next time if the student returns.\n\n\
        Conversation:\n{}",
        conversation_text
    );
    call_claude(api_key, system, &prompt, 300).await
}
