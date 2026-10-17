//! What one hook event writes for the pane (pure): the agent state for the
//! state file, the session's model for the model file, and the subagent
//! files.

use serde_json::{json, Value};

use crate::text::ellipsize;

/// What a hook event does to the pane's subagent files.
#[derive(Debug, PartialEq)]
pub enum SubagentChange {
    /// A subagent started: its file, with its type and start time.
    Start { id: String, record: Value },
    /// A subagent finished: its file goes.
    Stop { id: String },
    /// A session started or ended: no subagent of an earlier one is left.
    Clear,
}

/// `now` is ms since 1970, the subagent's start.
pub fn subagent_change(input: &Value, now: u64) -> Option<SubagentChange> {
    let id = || input.get("agent_id")?.as_str().filter(|id| !id.is_empty()).map(str::to_owned);
    Some(match input.get("hook_event_name")?.as_str()? {
        "SubagentStart" => SubagentChange::Start {
            id: id()?,
            record: json!({ "type": input.get("agent_type"), "started": now }),
        },
        "SubagentStop" => SubagentChange::Stop { id: id()? },
        "SessionStart" | "SessionEnd" => SubagentChange::Clear,
        _ => return None,
    })
}

/// Longest command or path kept in a permission message.
const DETAIL_CHARS: usize = 80;

/// The state file's record, or None when the event changes no state. The
/// transcript lets agent/ check the model of each answer. `previous` is the
/// pane's record written just before, if any.
pub fn state_record(input: &Value, previous: Option<&Value>) -> Option<Value> {
    let state = state_of(input)?;
    let message = kept_permission_detail(input, previous).or_else(|| message_of(input));
    Some(json!({
        "session_id": input.get("session_id"),
        "cwd": input.get("cwd"),
        "transcript_path": input.get("transcript_path"),
        "state": state,
        "message": message,
    }))
}

/// Claude Code sends a permission notification right after the
/// PermissionRequest of the same prompt. Its text names no tool, so the
/// request's tool and command stay.
fn kept_permission_detail(input: &Value, previous: Option<&Value>) -> Option<String> {
    let previous = previous?;
    let notice = input.get("notification_type").and_then(Value::as_str) == Some("permission_prompt");
    let same_prompt = previous.get("state").and_then(Value::as_str) == Some("permission")
        && previous.get("session_id") == input.get("session_id");
    (notice && same_prompt).then(|| previous.get("message")?.as_str().map(str::to_owned))?
}

/// The model file's record when the event tells the session's model:
/// SessionStart and PostModelSwitch. A SessionStart without one (a resumed
/// session) records the model as unknown, so the one of an earlier session
/// in the pane is not used; after /clear the model stays as it was.
pub fn model_record(input: &Value) -> Option<Value> {
    let event = input.get("hook_event_name")?.as_str()?;
    let field = match event {
        "SessionStart" => "model",
        "PostModelSwitch" => "to_model",
        _ => return None,
    };
    let model = input.get(field).and_then(Value::as_str).filter(|m| !m.is_empty());
    let cleared = input.get("source").and_then(Value::as_str) == Some("clear");
    if model.is_none() && (event != "SessionStart" || cleared) {
        return None;
    }
    Some(json!({ "session_id": input.get("session_id"), "model": model }))
}

/// The agent state a hook event stands for, or None when it changes nothing.
fn state_of(input: &Value) -> Option<&'static str> {
    Some(match input.get("hook_event_name")?.as_str()? {
        "SessionStart" => "idle",
        "UserPromptSubmit" => "working",
        "PermissionRequest" => "permission",
        "Stop" | "StopFailure" => "done",
        "SessionEnd" => "ended",
        "Notification" => match input.get("notification_type")?.as_str()? {
            "permission_prompt" => "permission",
            "idle_prompt" => "waiting",
            "elicitation_dialog" => "question",
            _ => return None,
        },
        _ => return None,
    })
}

/// What the agent waits for: the notification text, or the tool asking for
/// permission with its command, file or address.
fn message_of(input: &Value) -> Option<String> {
    match input.get("hook_event_name")?.as_str()? {
        "Notification" => input.get("message")?.as_str().map(str::to_owned),
        "PermissionRequest" => {
            let tool = input.get("tool_name")?.as_str()?;
            let args = input.get("tool_input");
            let detail = ["command", "file_path", "url"]
                .iter()
                .find_map(|key| args?.get(key)?.as_str());
            Some(match detail {
                Some(detail) => format!("{tool}: {}", shorten(detail)),
                None => tool.to_owned(),
            })
        }
        _ => None,
    }
}

fn shorten(text: &str) -> String {
    ellipsize(text.lines().next().unwrap_or_default(), DETAIL_CHARS)
}

#[cfg(test)]
#[path = "records_tests.rs"]
mod tests;
