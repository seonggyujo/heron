//! What the agent is doing, read from the entries of its transcript (pure):
//! the step it is on (thinking, writing its answer, or running a tool on
//! something) and the tools it ran in this turn. Claude Code writes a tool
//! call when it starts and the tool's result when it ends; a prompt from the
//! user starts a new turn. Subagents' entries are skipped: a pane shows its
//! main conversation.

use serde::Serialize;
use serde_json::Value;

use super::entries::{blocks, is_answer, is_prompt, is_subagent, tool_results};
use super::timestamps::entry_time;
use crate::text::ellipsize;

/// Tool calls kept for one turn; older ones drop off.
const TURN_MAX: usize = 40;
/// Characters kept of what a tool works on.
const TARGET_CHARS: usize = 80;

#[derive(Serialize, Clone, Debug, Default, PartialEq)]
pub struct Activity {
    step: Option<Step>,
    turn: Vec<ToolCall>,
}

/// `at`: when the step began, in ms since the Unix epoch.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum Step {
    Thinking { at: u64 },
    Writing { at: u64 },
    Tool { tool: String, target: Option<String>, at: u64 },
}

#[derive(Serialize, Clone, Debug, PartialEq)]
struct ToolCall {
    #[serde(skip)]
    id: String,
    tool: String,
    target: Option<String>,
    at: u64,
    done: bool,
}

impl Activity {
    pub fn take(&mut self, entry: &Value) {
        if is_subagent(entry) {
            return;
        }
        let at = entry_time(entry).unwrap_or(0);
        if is_answer(entry) {
            blocks(entry).iter().for_each(|b| self.answer(b, at));
        } else if is_prompt(entry) {
            self.turn.clear();
            self.step = Some(Step::Thinking { at });
        } else {
            self.results(&tool_results(entry), at);
        }
    }

    fn answer(&mut self, block: &Value, at: u64) {
        match block.get("type").and_then(Value::as_str) {
            Some("thinking" | "redacted_thinking") => self.step = Some(Step::Thinking { at }),
            Some("text") if block.get("text").and_then(Value::as_str).is_some_and(|t| !t.trim().is_empty()) => {
                self.step = Some(Step::Writing { at });
            }
            Some("tool_use") => {
                let Some(tool) = block.get("name").and_then(Value::as_str) else { return };
                let id = block.get("id").and_then(Value::as_str).unwrap_or_default().to_owned();
                let target = block.get("input").and_then(target_of);
                if self.turn.len() == TURN_MAX {
                    self.turn.remove(0);
                }
                self.turn.push(ToolCall { id, tool: tool.to_owned(), target: target.clone(), at, done: false });
                self.step = Some(Step::Tool { tool: tool.to_owned(), target, at });
            }
            _ => {}
        }
    }

    /// Tool results end their calls.
    fn results(&mut self, results: &[&str], at: u64) {
        if results.is_empty() {
            return;
        }
        for call in self.turn.iter_mut().filter(|c| results.contains(&c.id.as_str())) {
            call.done = true;
        }
        // Calls can run side by side: the newest still running is the step.
        self.step = Some(match self.turn.iter().rev().find(|c| !c.done) {
            Some(c) => Step::Tool { tool: c.tool.clone(), target: c.target.clone(), at: c.at },
            None => Step::Thinking { at },
        });
    }
}

/// What a tool works on: a file's name, the description the agent gave
/// (shell commands and subagents have one), a command's first line, a
/// page's host, or its pattern or query.
fn target_of(input: &Value) -> Option<String> {
    let text = |key: &str| input.get(key).and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty());
    let target = if let Some(path) = text("file_path").or_else(|| text("notebook_path")) {
        path.rsplit(['/', '\\']).next().unwrap_or(path)
    } else if let Some(description) = text("description") {
        description
    } else if let Some(command) = text("command") {
        command.lines().next().unwrap_or(command).trim()
    } else if let Some(url) = text("url") {
        let rest = url.split_once("://").map_or(url, |(_, rest)| rest);
        rest.split('/').next().unwrap_or(rest)
    } else {
        ["pattern", "query", "skill", "subagent_type"].iter().find_map(|key| text(key))?
    };
    Some(ellipsize(target, TARGET_CHARS))
}

#[cfg(test)]
#[path = "activity_tests.rs"]
mod tests;
