//! Text normalization for speech output (TTS).

/// Normalize text for speech: say maths symbols as words and strip markdown/LaTeX.
pub fn clean_for_speech(text: &str) -> String {
    let mut s = text.to_string();
    for (from, to) in [
        ("\\frac", " "),
        ("\\times", " times "),
        ("\\div", " over "),
        ("/", " over "),
        ("+", " plus "),
        ("=", " equals "),
        (" x ", " times "),
        (" - ", " minus "),
        ("×", " times "),
        ("÷", " over "),
        ("%", " percent "),
        ("−", " minus "),
        ("≈", " approximately "),
        ("²", " squared "),
        ("³", " cubed "),
        ("°", " degrees "),
    ] {
        s = s.replace(from, to);
    }

    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '*' | '#' | '`' | '_' | '$' | '\\' => continue,
            '(' | ')' | '[' | ']' | '{' | '}' => out.push(' '),
            '\n' => out.push_str(". "),
            _ => out.push(c),
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}
