//! The tokens an agent's main conversation used, from the `usage` of each
//! answer in its transcript: for the whole session and for the current turn.
//! One answer is written as several lines that share its message id, so
//! each id counts once, with the last usage written for it. Pure.

use std::collections::{HashMap, HashSet};

use serde::Serialize;
use serde_json::Value;

use super::entries::{is_answer, is_prompt, is_subagent};

/// Tokens by kind, as the API bills them: fresh input, output, input
/// written to the prompt cache, and input read from it.
#[derive(Serialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub input: u64,
    pub output: u64,
    pub cache_write: u64,
    pub cache_read: u64,
}

impl Usage {
    fn of(usage: &Value) -> Self {
        let n = |key: &str| usage.get(key).and_then(Value::as_u64).unwrap_or(0);
        Self {
            input: n("input_tokens"),
            output: n("output_tokens"),
            cache_write: n("cache_creation_input_tokens"),
            cache_read: n("cache_read_input_tokens"),
        }
    }

    fn plus(self, o: Self) -> Self {
        Self {
            input: self.input + o.input,
            output: self.output + o.output,
            cache_write: self.cache_write + o.cache_write,
            cache_read: self.cache_read + o.cache_read,
        }
    }
}

/// The message id and usage on an answer line of the main conversation.
pub fn answer_usage(entry: &Value) -> Option<(String, Usage)> {
    if is_subagent(entry) || !is_answer(entry) {
        return None;
    }
    let message = entry.get("message")?;
    let id = message.get("id")?.as_str()?;
    Some((id.to_owned(), Usage::of(message.get("usage")?)))
}

/// What goes to the frontend. `complete`: the part of the session written
/// before Heron followed it has been counted too.
#[derive(Serialize, Clone, Debug, Default, PartialEq)]
pub struct TokenReport {
    session: Usage,
    turn: Usage,
    complete: bool,
}

#[derive(Default)]
pub struct Tokens {
    answers: HashMap<String, Usage>,
    turn: HashSet<String>,
    earlier_counted: bool,
}

impl Tokens {
    pub fn take(&mut self, entry: &Value) {
        if is_prompt(entry) && !is_subagent(entry) {
            self.turn.clear();
        } else if let Some((id, usage)) = answer_usage(entry) {
            self.turn.insert(id.clone());
            self.answers.insert(id, usage);
        }
    }

    /// The answers counted in the part written before following began
    /// (token_scan.rs). An answer also seen since keeps the newer count.
    pub fn add_earlier(&mut self, earlier: HashMap<String, Usage>) {
        for (id, usage) in earlier {
            self.answers.entry(id).or_insert(usage);
        }
        self.earlier_counted = true;
    }

    pub fn report(&self) -> TokenReport {
        let sum = |ids: &mut dyn Iterator<Item = &Usage>| ids.fold(Usage::default(), |a, u| a.plus(*u));
        TokenReport {
            session: sum(&mut self.answers.values()),
            turn: sum(&mut self.turn.iter().filter_map(|id| self.answers.get(id))),
            complete: self.earlier_counted,
        }
    }
}

#[cfg(test)]
#[path = "tokens_tests.rs"]
mod tests;
