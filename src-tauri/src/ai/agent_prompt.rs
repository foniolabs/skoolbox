/// The master system prompt for Martha, the SkoolBox AI Tutor.
///
/// SINGLE SOURCE OF TRUTH: the persona text lives in
/// `curriculum/nigerian.system_prompt.txt` and is compiled into the binary here
/// via `include_str!`. Editing that file (and rebuilding) updates the runtime
/// persona, the Ollama Modelfile (regenerated from the same file by
/// `curriculum/generate_modelfile.py`), and the training prompts — one edit,
/// everywhere. Do NOT paste the persona text into this file.
///
/// Compiling it in (rather than reading the file at runtime) keeps the offline
/// build robust: there is no path/resource lookup that can fail on a packaged
/// Windows install. Per-curriculum runtime persona variants are a v2.0 concern
/// (see docs/MARTHA_PERSONA.md §6); MVP is Nigerian-only.
pub fn master_system_prompt() -> &'static str {
    include_str!("../../../curriculum/nigerian.system_prompt.txt")
}
