//! What the end of one Claude Code session file says about the session
//! (pure): the folder it last ran in and a title. Also the shape a session
//! id must have before Heron types it into a shell.

use serde_json::Value;

use crate::text::ellipsize;

/// Longest title kept; a longer one is cut there.
const TITLE_CHARS: usize = 80;

#[derive(Clone, Debug, PartialEq)]
pub struct Summary {
    pub cwd: String,
    pub title: String,
}

/// `tail` is the end of the file, its first line possibly cut. The last
/// record of each kind wins, as in Claude Code: a title the user gave
/// (`/rename`), else the generated one, else the last prompt. None when the
/// tail names no folder or nothing to call the session.
pub fn summarize(tail: &str) -> Option<Summary> {
    let (mut cwd, mut custom, mut generated, mut prompt) = (None, None, None, None);
    for line in tail.lines() {
        let Ok(entry) = serde_json::from_str::<Value>(line) else { continue };
        let text = |key: &str| {
            let value = entry.get(key)?.as_str()?;
            (!value.trim().is_empty()).then(|| value.to_owned())
        };
        cwd = text("cwd").or(cwd);
        match entry.get("type").and_then(Value::as_str) {
            Some("custom-title") => custom = text("customTitle").or(custom),
            Some("ai-title") => generated = text("aiTitle").or(generated),
            Some("last-prompt") => prompt = text("lastPrompt").or(prompt),
            _ => {}
        }
    }
    let title = custom.or(generated).or(prompt)?;
    Some(Summary { cwd: cwd?, title: first_line(&title) })
}

fn first_line(text: &str) -> String {
    ellipsize(text.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or_default(), TITLE_CHARS)
}

/// A UUID (`158ec1a7-965f-43a3-99cb-8f9e257cb741`), the name Claude Code
/// gives session files. Nothing else is safe to type after `--resume`.
pub fn is_session_id(id: &str) -> bool {
    id.len() == 36
        && id.char_indices().all(|(i, c)| match i {
            8 | 13 | 18 | 23 => c == '-',
            _ => c.is_ascii_hexdigit(),
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    const CWD: &str = r#"{"type":"user","cwd":"C:\\work\\api","message":{}}"#;

    fn summary(lines: &[&str]) -> Option<Summary> {
        summarize(&lines.join("\n"))
    }

    #[test]
    fn the_last_title_of_the_best_kind_wins() {
        let ai = |t: &str| format!(r#"{{"type":"ai-title","aiTitle":"{t}"}}"#);
        let prompt = r#"{"type":"last-prompt","lastPrompt":"run the tests"}"#;
        let title = |lines: &[&str]| summary(lines).map(|s| s.title);
        assert_eq!(title(&[CWD, prompt]).as_deref(), Some("run the tests"));
        assert_eq!(title(&[CWD, &ai("Old"), prompt, &ai("Fix the login")]).as_deref(), Some("Fix the login"));
        let custom = r#"{"type":"custom-title","customTitle":"Release"}"#;
        assert_eq!(title(&[CWD, custom, &ai("Fix the login")]).as_deref(), Some("Release"));
    }

    #[test]
    fn the_folder_is_the_last_one_recorded() {
        let moved = r#"{"type":"assistant","cwd":"C:\\work\\web"}"#;
        let prompt = r#"{"type":"last-prompt","lastPrompt":"hi"}"#;
        assert_eq!(summary(&[CWD, moved, prompt]).unwrap().cwd, r"C:\work\web");
    }

    #[test]
    fn a_cut_first_line_and_untitled_sessions_are_skipped() {
        let cut = r#"t","aiTitle":"half"}"#;
        assert_eq!(summary(&[cut, CWD]), None, "no title");
        assert_eq!(summary(&[r#"{"type":"last-prompt","lastPrompt":"hi"}"#]), None, "no folder");
        let blank = r#"{"type":"last-prompt","lastPrompt":"  "}"#;
        assert_eq!(summary(&[CWD, blank]), None);
    }

    #[test]
    fn a_title_is_one_short_line() {
        let long = format!(r#"{{"type":"last-prompt","lastPrompt":"\n  first line\nsecond {}"}}"#, "x".repeat(100));
        assert_eq!(summary(&[CWD, &long]).unwrap().title, "first line");
        let wide = format!(r#"{{"type":"ai-title","aiTitle":"{}"}}"#, "y".repeat(TITLE_CHARS + 5));
        assert_eq!(summary(&[CWD, &wide]).unwrap().title.chars().count(), TITLE_CHARS + 1);
    }

    #[test]
    fn only_uuids_are_session_ids() {
        assert!(is_session_id("158ec1a7-965f-43a3-99cb-8f9e257cb741"));
        assert!(!is_session_id("158ec1a7-965f-43a3-99cb-8f9e257cb74"));
        assert!(!is_session_id("158ec1a7-965f-43a3-99cb-8f9e257cb7;&"));
        assert!(!is_session_id("158ec1a7x965f-43a3-99cb-8f9e257cb741"));
        assert!(!is_session_id("agent-158ec1a7-965f-43a3-99cb-8f9e257"));
    }
}
