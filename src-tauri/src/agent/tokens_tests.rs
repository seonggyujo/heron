//! Tests for tokens.rs: each answer counts once, turns, subagents, the earlier part.

use super::*;
use serde_json::json;

fn answer(id: &str, input: u64, output: u64) -> Value {
    json!({"type": "assistant", "message": {"id": id, "usage": {
        "input_tokens": input, "output_tokens": output,
        "cache_creation_input_tokens": 100, "cache_read_input_tokens": 1000}}})
}

#[test]
fn counts_each_answer_once_with_its_last_usage() {
    let mut t = Tokens::default();
    t.take(&answer("m1", 5, 10));
    t.take(&answer("m1", 5, 40));
    t.take(&answer("m2", 3, 2));
    let r = t.report();
    assert_eq!(r.session, Usage { input: 8, output: 42, cache_write: 200, cache_read: 2000 });
    assert_eq!(r.turn, r.session);
}

#[test]
fn a_prompt_starts_the_turn_over() {
    let mut t = Tokens::default();
    t.take(&answer("m1", 5, 10));
    t.take(&json!({"type": "user", "message": {"content": "next"}}));
    t.take(&json!({"type": "user", "message": {"content": [{"type": "tool_result", "tool_use_id": "x"}]}}));
    t.take(&answer("m2", 1, 1));
    let r = t.report();
    assert_eq!(r.turn.output, 1);
    assert_eq!(r.session.output, 11);
}

#[test]
fn subagents_and_other_lines_do_not_count() {
    let mut t = Tokens::default();
    let mut side = answer("s1", 50, 50);
    side["isSidechain"] = json!(true);
    t.take(&side);
    t.take(&json!({"type": "assistant", "message": {"id": "m0"}}));
    t.take(&json!({"type": "summary"}));
    assert_eq!(t.report().session, Usage::default());
}

#[test]
fn the_earlier_part_adds_without_counting_twice() {
    let mut t = Tokens::default();
    t.take(&answer("m2", 1, 7));
    assert!(!t.report().complete);
    let earlier = HashMap::from([("m1".to_owned(), Usage { output: 10, ..Usage::default() }), ("m2".to_owned(), Usage { output: 3, ..Usage::default() })]);
    t.add_earlier(earlier);
    let r = t.report();
    assert!(r.complete);
    assert_eq!(r.session.output, 17, "m2 keeps the count seen since");
    assert_eq!(r.turn.output, 7);
}
