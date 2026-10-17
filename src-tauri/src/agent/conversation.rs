//! One transcript the hooks named, followed while it grows (transcript.rs),
//! and what is read from it: the models of new answers for the model check,
//! what the agent is doing (activity.rs) and the tokens it used (tokens.rs;
//! the part written before following is counted aside by token_scan.rs).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::Receiver;

use super::activity::Activity;
use super::token_scan;
use super::tokens::{TokenReport, Tokens, Usage};
use super::transcript::Transcript;

pub struct Conversation {
    transcript: Transcript,
    activity: Activity,
    tokens: Tokens,
    /// The earlier part's count, until it arrives.
    earlier: Option<Receiver<HashMap<String, Usage>>>,
}

impl Conversation {
    pub fn follow(path: PathBuf) -> Self {
        let transcript = Transcript::follow(path.clone());
        let earlier = Some(token_scan::spawn(path, transcript.offset()));
        Self { transcript, activity: Activity::default(), tokens: Tokens::default(), earlier }
    }

    pub fn path(&self) -> &Path {
        self.transcript.path()
    }

    /// Reads what was added since the last read; returns the models of the
    /// new answers, oldest first.
    pub fn read(&mut self) -> Vec<String> {
        if let Some(answers) = self.earlier.as_ref().and_then(|rx| rx.try_recv().ok()) {
            self.tokens.add_earlier(answers);
            self.earlier = None;
        }
        let news = self.transcript.read_new();
        for entry in &news.entries {
            self.activity.take(entry);
            self.tokens.take(entry);
        }
        news.answers.into_iter().map(|a| a.model).collect()
    }

    pub fn activity(&self) -> &Activity {
        &self.activity
    }

    pub fn tokens(&self) -> TokenReport {
        self.tokens.report()
    }
}
