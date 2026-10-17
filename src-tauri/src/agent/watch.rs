//! Everything Heron watches for one pane, one round at a time: the agent
//! files (sent on to the frontend as they are), the subagents running, and
//! from the transcript the hooks name (conversation.rs): what the agent is
//! doing, the tokens it used, and the model check against the model they
//! report (or, while they do not know it, the model the heron-limits status
//! line shows).

use std::collections::HashMap;
use std::path::Path;
use std::time::SystemTime;

use log::trace;
use serde_json::Value;

use super::activity::Activity;
use super::conversation::Conversation;
use super::file_names::{self, Kind};
use super::model_check::{ModelCheck, Verdict};
use super::subagents;
use super::tokens::TokenReport;

/// One `agent-update` for the frontend: `kind` is "state", "status",
/// "check", "subagents", "activity" or "tokens".
pub struct Update {
    pub kind: &'static str,
    pub data: Value,
}

pub struct PaneWatch {
    modified: HashMap<Kind, SystemTime>,
    conversation: Option<Conversation>,
    check: ModelCheck,
    sent: Verdict,
    subagents: Value,
    sent_activity: Activity,
    sent_tokens: TokenReport,
}

impl PaneWatch {
    pub fn new() -> Self {
        let check = ModelCheck::default();
        let sent = check.verdict();
        Self {
            modified: HashMap::new(),
            conversation: None,
            check,
            sent,
            subagents: Value::Array(Vec::new()),
            sent_activity: Activity::default(),
            sent_tokens: TokenReport::default(),
        }
    }

    /// The updates of this round, in order. New answers are judged before a
    /// new selection is taken, so an answer that came before a switch is
    /// judged against the model it was asked of.
    pub fn poll(&mut self, dir: &Path, pty: u32) -> Vec<Update> {
        let mut updates = Vec::new();
        if let Some(state) = self.read_changed(dir, pty, Kind::State) {
            self.follow(&state);
            updates.push(Update { kind: "state", data: state });
        }
        let status = self.read_changed(dir, pty, Kind::Status);
        if let Some(conversation) = &mut self.conversation {
            for model in conversation.read() {
                self.check.answered(&model);
            }
        }
        if let Some(model) = self.read_changed(dir, pty, Kind::Model) {
            self.check.select(model.get("model").and_then(Value::as_str));
        }
        if let Some(status) = status {
            if let Some(model) = status.get("model").and_then(Value::as_str) {
                self.check.select_from_status_line(model);
            }
            updates.push(Update { kind: "status", data: status });
        }
        let verdict = self.check.verdict();
        if verdict != self.sent {
            updates.push(Update { kind: "check", data: serde_json::to_value(&verdict).unwrap_or_default() });
            self.sent = verdict;
        }
        let subagents = subagents::read(dir, &file_names::key(pty));
        if subagents != self.subagents {
            updates.push(Update { kind: "subagents", data: subagents.clone() });
            self.subagents = subagents;
        }
        let activity = self.conversation.as_ref().map(|c| c.activity().clone()).unwrap_or_default();
        if activity != self.sent_activity {
            updates.push(Update { kind: "activity", data: serde_json::to_value(&activity).unwrap_or_default() });
            self.sent_activity = activity;
        }
        let tokens = self.conversation.as_ref().map(Conversation::tokens).unwrap_or_default();
        if tokens != self.sent_tokens {
            updates.push(Update { kind: "tokens", data: serde_json::to_value(&tokens).unwrap_or_default() });
            self.sent_tokens = tokens;
        }
        updates
    }

    /// The hooks name the session's transcript; a new one (a new session, or
    /// /clear) starts the check, the activity and the tokens over.
    fn follow(&mut self, state: &Value) {
        let Some(path) = state.get("transcript_path").and_then(Value::as_str) else { return };
        if self.conversation.as_ref().is_some_and(|c| c.path() == Path::new(path)) {
            return;
        }
        self.conversation = Some(Conversation::follow(path.into()));
        self.check.restart();
    }

    /// The file's JSON when it changed since the last round. Writers replace
    /// files in one step (write, then rename), so a read never sees half a
    /// file; one that cannot be read yet is tried again next round.
    fn read_changed(&mut self, dir: &Path, pty: u32, kind: Kind) -> Option<Value> {
        let file = file_names::path(dir, pty, kind);
        let modified = std::fs::metadata(&file).and_then(|m| m.modified()).ok()?;
        if self.modified.get(&kind) == Some(&modified) {
            return None;
        }
        self.modified.insert(kind, modified);
        match std::fs::read(&file).map(|b| serde_json::from_slice::<Value>(&b)) {
            Ok(Ok(data)) => Some(data),
            _ => {
                trace!("agent: pty {pty} {} unreadable, next round", kind.name());
                self.modified.remove(&kind);
                None
            }
        }
    }
}
