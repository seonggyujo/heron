//! Tests for activity.rs: steps, tool calls, turns and what a tool works on.

use serde_json::{json, Value};

use super::*;

fn assistant(block: Value) -> Value {
    json!({"type": "assistant", "timestamp": "1970-01-01T00:00:01Z", "message": {"content": [block]}})
}

fn tool_use(id: &str, name: &str, input: Value) -> Value {
    assistant(json!({"type": "tool_use", "id": id, "name": name, "input": input}))
}

fn tool_result(id: &str) -> Value {
    json!({"type": "user", "timestamp": "1970-01-01T00:00:02Z",
           "message": {"content": [{"type": "tool_result", "tool_use_id": id, "content": "ok"}]}})
}

fn shown(a: &Activity) -> Value {
    serde_json::to_value(a).unwrap()
}

#[test]
fn follows_thinking_tools_and_the_answer() {
    let mut a = Activity::default();
    a.take(&assistant(json!({"type": "thinking", "thinking": "hm"})));
    assert_eq!(shown(&a)["step"], json!({"kind": "thinking", "at": 1000}));

    a.take(&tool_use("t1", "Edit", json!({"file_path": "C:\\code\\heron\\src\\main.ts"})));
    assert_eq!(shown(&a)["step"], json!({"kind": "tool", "tool": "Edit", "target": "main.ts", "at": 1000}));
    assert_eq!(shown(&a)["turn"], json!([{"tool": "Edit", "target": "main.ts", "at": 1000, "done": false}]));

    a.take(&tool_result("t1"));
    assert_eq!(shown(&a)["step"], json!({"kind": "thinking", "at": 2000}), "the model takes the result");
    assert_eq!(shown(&a)["turn"][0]["done"], json!(true));

    a.take(&assistant(json!({"type": "text", "text": "Done."})));
    assert_eq!(shown(&a)["step"]["kind"], json!("writing"));
    a.take(&assistant(json!({"type": "text", "text": "  "})));
    assert_eq!(shown(&a)["step"]["kind"], json!("writing"), "an empty text block changes nothing");
}

#[test]
fn the_newest_running_call_is_the_step() {
    let mut a = Activity::default();
    a.take(&tool_use("t1", "Bash", json!({"command": "npm test\necho done"})));
    a.take(&tool_use("t2", "Grep", json!({"pattern": "useState"})));
    a.take(&tool_result("t2"));
    assert_eq!(shown(&a)["step"]["tool"], json!("Bash"));
    assert_eq!(shown(&a)["step"]["target"], json!("npm test"));
}

#[test]
fn a_prompt_starts_a_new_turn() {
    let mut a = Activity::default();
    a.take(&tool_use("t1", "Read", json!({"file_path": "/a/b.rs"})));
    a.take(&json!({"type": "user", "isMeta": true, "message": {"content": "caveat"}}));
    assert_eq!(shown(&a)["turn"].as_array().unwrap().len(), 1, "meta entries are not prompts");
    a.take(&json!({"type": "user", "timestamp": "1970-01-01T00:00:03Z", "message": {"content": "next"}}));
    assert_eq!(shown(&a), json!({"step": {"kind": "thinking", "at": 3000}, "turn": []}));
}

#[test]
fn skips_subagents_and_keeps_the_turn_short() {
    let mut a = Activity::default();
    let mut side = tool_use("s", "Read", json!({}));
    side["isSidechain"] = json!(true);
    a.take(&side);
    assert_eq!(a, Activity::default());
    for i in 0..TURN_MAX + 5 {
        a.take(&tool_use(&format!("t{i}"), "Read", json!({})));
    }
    assert_eq!(shown(&a)["turn"].as_array().unwrap().len(), TURN_MAX);
}

#[test]
fn names_what_a_tool_works_on() {
    assert_eq!(target_of(&json!({"url": "https://docs.rs/serde/latest"})).as_deref(), Some("docs.rs"));
    assert_eq!(target_of(&json!({"query": " tauri canvas "})).as_deref(), Some("tauri canvas"));
    assert_eq!(target_of(&json!({"description": "Find callers", "prompt": "long"})).as_deref(), Some("Find callers"));
    let described = json!({"command": "cd /c/x; npm test", "description": "Run the tests"});
    assert_eq!(target_of(&described).as_deref(), Some("Run the tests"), "the agent's words before the command");
    assert_eq!(target_of(&json!({"todos": []})), None);
    let long = target_of(&json!({"command": "x".repeat(200)})).unwrap();
    assert_eq!(long.chars().count(), TARGET_CHARS + 1);
    assert!(long.ends_with('…'));
}
