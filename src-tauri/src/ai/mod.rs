pub mod chunking;
pub mod classroom;
// Cloud backend — dev builds only; release builds are offline-only (see provider.rs).
#[cfg(debug_assertions)]
pub mod claude_api;
pub mod json;
pub mod martha;
pub mod ollama;
pub mod provider;
pub mod prompts;
pub mod rag;
pub mod runtime;
pub mod agent_prompt;
