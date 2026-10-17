//! What a transcript entry is, for the readers of the main conversation
//! (activity.rs, tokens.rs): an answer and its content blocks, the results
//! of tool calls, or a prompt from the user that starts a turn. Pure.

use serde_json::Value;

/// Written by a subagent (its own conversation), not the main one.
pub fn is_subagent(entry: &Value) -> bool {
    entry.get("isSidechain").and_then(Value::as_bool) == Some(true)
}

pub fn is_answer(entry: &Value) -> bool {
    entry.get("type").and_then(Value::as_str) == Some("assistant")
}

/// The content blocks of an answer or a user entry; none for plain text.
pub fn blocks(entry: &Value) -> &[Value] {
    entry.pointer("/message/content").and_then(Value::as_array).map(Vec::as_slice).unwrap_or_default()
}

/// The ids of the tool calls whose results a user entry carries.
pub fn tool_results(entry: &Value) -> Vec<&str> {
    blocks(entry)
        .iter()
        .filter(|b| b.get("type").and_then(Value::as_str) == Some("tool_result"))
        .filter_map(|b| b.get("tool_use_id").and_then(Value::as_str))
        .collect()
}

/// Something the user sent (not tool results, not a note Claude Code adds
/// as `isMeta`): a new turn starts.
pub fn is_prompt(entry: &Value) -> bool {
    entry.get("type").and_then(Value::as_str) == Some("user")
        && entry.get("isMeta").and_then(Value::as_bool) != Some(true)
        && tool_results(entry).is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn tells_prompts_from_tool_results_and_notes() {
        assert!(is_prompt(&json!({"type": "user", "message": {"content": "fix it"}})));
        assert!(is_prompt(&json!({"type": "user", "message": {"content": [{"type": "text", "text": "fix it"}]}})));
        let results = json!({"type": "user", "message": {"content": [{"type": "tool_result", "tool_use_id": "t1"}]}});
        assert!(!is_prompt(&results));
        assert_eq!(tool_results(&results), ["t1"]);
        assert!(!is_prompt(&json!({"type": "user", "isMeta": true, "message": {"content": "caveat"}})));
        assert!(!is_prompt(&json!({"type": "assistant", "message": {"content": []}})));
    }
}
