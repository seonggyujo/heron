//! Answers in a Claude Code transcript (one JSON entry per line): which
//! model wrote each answer of the main conversation. Pure: parsing and
//! comparing only.

use serde_json::Value;

use super::timestamps::entry_time;
use crate::claude_version::{self, Version};

/// Claude Code tells hooks about model switches (PostModelSwitch) since this
/// version. Answers an older one wrote are not judged: after /model they
/// would look like mismatches.
const MODEL_SWITCH_HOOK: Version = (2, 1, 251);

/// One answer of the main conversation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Answer {
    /// `message.id`. One answer is written as several lines (thinking, text,
    /// tool calls) that share it.
    pub id: Option<String>,
    pub model: String,
    /// When it was written, in ms since the Unix epoch.
    pub at: Option<u64>,
}

/// The answer in one transcript entry, or None for anything else. Subagent
/// entries (`isSidechain`) are skipped because subagents may use other
/// models on purpose, and so are `<synthetic>` placeholders written on
/// interruptions and errors, and answers of a Claude Code older than
/// MODEL_SWITCH_HOOK.
pub fn answer_of(entry: &Value) -> Option<Answer> {
    if entry.get("type")?.as_str()? != "assistant" || entry.get("isSidechain").and_then(Value::as_bool) == Some(true) {
        return None;
    }
    let written_by = entry.get("version").and_then(Value::as_str).and_then(claude_version::parse);
    if written_by.is_some_and(|v| v < MODEL_SWITCH_HOOK) {
        return None;
    }
    let message = entry.get("message")?;
    let model = message.get("model")?.as_str().filter(|m| !m.is_empty() && *m != "<synthetic>")?;
    Some(Answer {
        id: message.get("id").or_else(|| entry.get("uuid")).and_then(Value::as_str).map(str::to_owned),
        model: model.to_owned(),
        at: entry_time(entry),
    })
}

/// Same model, ignoring a suffix such as `[1m]` and a date such as
/// `-20251001`.
pub fn same_model(a: &str, b: &str) -> bool {
    base_model(a) == base_model(b)
}

fn base_model(id: &str) -> String {
    let id = match id.find('[') {
        Some(i) if id.ends_with(']') => &id[..i],
        _ => id,
    };
    let id = match id.rsplit_once('-') {
        Some((head, date)) if date.len() == 8 && date.bytes().all(|b| b.is_ascii_digit()) => head,
        _ => id,
    };
    id.to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(extra: &str) -> Value {
        let text = format!(
            r#"{{"type":"assistant","isSidechain":false,"timestamp":"2026-10-10T00:18:30.302Z",{extra}"message":{{"id":"msg_1","model":"claude-opus-5-5"}}}}"#
        );
        serde_json::from_str(&text).unwrap()
    }

    #[test]
    fn reads_the_answer_of_the_main_conversation() {
        let answer = answer_of(&line("")).unwrap();
        assert_eq!(answer.id.as_deref(), Some("msg_1"));
        assert_eq!(answer.model, "claude-opus-5-5");
        assert_eq!(answer.at, Some(1_791_591_510_302));
    }

    #[test]
    fn skips_subagents_placeholders_and_other_entries() {
        assert_eq!(answer_of(&line(r#""isSidechain":true,"#)), None);
        let mut placeholder = line("");
        placeholder["message"]["model"] = "<synthetic>".into();
        assert_eq!(answer_of(&placeholder), None);
        assert_eq!(answer_of(&serde_json::json!({"type": "user", "message": {"content": "assistant"}})), None);
    }

    #[test]
    fn skips_answers_of_a_claude_code_that_cannot_report_model_switches() {
        assert_eq!(answer_of(&line(r#""version":"2.1.250","#)), None);
        assert!(answer_of(&line(r#""version":"2.1.251","#)).is_some());
    }

    #[test]
    fn compares_models_without_suffixes() {
        assert!(same_model("claude-opus-5-5[1m]", "claude-opus-5-5"));
        assert!(same_model("claude-haiku-4-5-20251001", "Claude-Haiku-4-5"));
        assert!(!same_model("claude-sonnet-5-5", "claude-opus-5-5"));
    }
}
