//! Shortening text for one line on screen (a tool's detail, a session
//! title, what an agent works on). Pure.

/// `text` cut after `keep` characters, with `…` added when it was cut.
pub fn ellipsize(text: &str, keep: usize) -> String {
    if text.chars().count() <= keep {
        return text.to_owned();
    }
    text.chars().take(keep).chain(['…']).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cuts_long_text_only() {
        assert_eq!(ellipsize("short", 5), "short");
        assert_eq!(ellipsize("longer", 5), "longe…");
        assert_eq!(ellipsize("한글 제목입니다", 4), "한글 제…");
    }
}
