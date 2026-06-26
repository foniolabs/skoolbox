//! Helpers for coaxing valid JSON out of LLM responses.
//!
//! Small local models (3B/7B) are far less reliable than Claude at returning
//! pure JSON — they wrap it in prose ("Here is your lesson: ..."), add code
//! fences, or trail commentary. `extract_json` strips that down to the payload;
//! the provider layer then validates and retries.

/// Pull the JSON payload out of a response that may contain markdown fences or
/// surrounding prose. Returns the best-effort JSON substring (caller validates).
pub fn extract_json(text: &str) -> String {
    let trimmed = text.trim();

    // 1. Prefer a fenced block: ```json ... ``` or ``` ... ```
    if let Some(inner) = strip_code_fence(trimmed) {
        // The fenced content itself may still have prose padding.
        if let Some(slice) = slice_brackets(inner) {
            return slice;
        }
        return inner.trim().to_string();
    }

    // 2. Otherwise slice from the first opening bracket to the matching last
    //    closing bracket, dropping any "Here is your..." prose around it.
    if let Some(slice) = slice_brackets(trimmed) {
        return slice;
    }

    trimmed.to_string()
}

/// Return the content inside the first ```...``` fence, if present.
fn strip_code_fence(text: &str) -> Option<&str> {
    let start = text.find("```")?;
    let after = &text[start + 3..];
    // Skip an optional language tag (e.g. "json\n").
    let after = match after.find('\n') {
        Some(nl) if after[..nl].chars().all(|c| c.is_alphanumeric()) => &after[nl + 1..],
        _ => after,
    };
    let end = after.find("```")?;
    Some(after[..end].trim())
}

/// Slice from the first `{`/`[` to the last matching `}`/`]`.
fn slice_brackets(text: &str) -> Option<String> {
    let open = text.find(['{', '['])?;
    let open_char = text.as_bytes()[open] as char;
    let close_char = if open_char == '{' { '}' } else { ']' };
    let close = text.rfind(close_char)?;
    if close > open {
        Some(text[open..=close].trim().to_string())
    } else {
        None
    }
}

/// Does this string parse as JSON?
pub fn is_valid(text: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(text).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_json_fence() {
        let s = "Sure! ```json\n{\"a\": 1}\n``` hope that helps";
        assert_eq!(extract_json(s), "{\"a\": 1}");
        assert!(is_valid(&extract_json(s)));
    }

    #[test]
    fn strips_plain_fence() {
        let s = "```\n[1, 2, 3]\n```";
        assert_eq!(extract_json(s), "[1, 2, 3]");
    }

    #[test]
    fn slices_prose_around_object() {
        let s = "Here is your lesson: {\"title\": \"Fractions\"} — enjoy!";
        assert_eq!(extract_json(s), "{\"title\": \"Fractions\"}");
    }

    #[test]
    fn passes_through_clean_json() {
        assert!(is_valid(&extract_json("{\"ok\": true}")));
    }
}
