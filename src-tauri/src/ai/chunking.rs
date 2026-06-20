//! Splits long documents (textbooks, curriculum PDFs-as-text, lesson notes,
//! past-question papers) into retrieval-sized chunks for the FTS5 index.
//!
//! Strategy: pack whole paragraphs together up to a target size, with a small
//! overlap so a concept that straddles a boundary still surfaces in search.
//! Paragraph-aware (not mid-sentence) keeps each chunk readable when injected
//! into Martha's prompt.

const TARGET_CHARS: usize = 1200;
const OVERLAP_PARAGRAPHS: usize = 1;

/// Split `text` into overlapping, paragraph-aware chunks.
/// Returns chunks in document order; empty input yields an empty Vec.
pub fn chunk_text(text: &str) -> Vec<String> {
    // Normalise newlines, then split into paragraphs on blank lines.
    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    let paragraphs: Vec<&str> = normalized
        .split("\n\n")
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();

    if paragraphs.is_empty() {
        return Vec::new();
    }

    let mut chunks: Vec<String> = Vec::new();
    let mut current: Vec<&str> = Vec::new();
    let mut current_len = 0usize;

    for para in &paragraphs {
        // A single oversized paragraph is hard-split so it still fits.
        if para.len() > TARGET_CHARS {
            if !current.is_empty() {
                chunks.push(current.join("\n\n"));
                current.clear();
                current_len = 0;
            }
            for piece in hard_split(para, TARGET_CHARS) {
                chunks.push(piece);
            }
            continue;
        }

        if current_len + para.len() > TARGET_CHARS && !current.is_empty() {
            chunks.push(current.join("\n\n"));
            // Carry the last paragraph(s) forward as overlap context.
            let keep = current.len().saturating_sub(OVERLAP_PARAGRAPHS);
            current = current.split_off(keep);
            current_len = current.iter().map(|p| p.len()).sum();
        }

        current.push(para);
        current_len += para.len();
    }

    if !current.is_empty() {
        chunks.push(current.join("\n\n"));
    }

    chunks
}

/// Hard-split an over-long paragraph on word boundaries near `max`.
fn hard_split(para: &str, max: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut buf = String::new();
    for word in para.split_whitespace() {
        if buf.len() + word.len() + 1 > max && !buf.is_empty() {
            out.push(std::mem::take(&mut buf));
        }
        if !buf.is_empty() {
            buf.push(' ');
        }
        buf.push_str(word);
    }
    if !buf.is_empty() {
        out.push(buf);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_input_yields_no_chunks() {
        assert!(chunk_text("   \n\n  ").is_empty());
    }

    #[test]
    fn short_doc_is_one_chunk() {
        let chunks = chunk_text("Photosynthesis is how plants make food.");
        assert_eq!(chunks.len(), 1);
    }

    #[test]
    fn long_doc_splits_into_multiple() {
        let para = "Nigeria is a country in West Africa. ".repeat(20);
        let doc = format!("{}\n\n{}\n\n{}", para, para, para);
        assert!(chunk_text(&doc).len() > 1);
    }
}
