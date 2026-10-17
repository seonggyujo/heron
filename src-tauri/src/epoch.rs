//! Times in ms since the Unix epoch, the unit of Heron's agent files, the
//! session list and the frontend.

use std::time::{SystemTime, UNIX_EPOCH};

pub fn millis(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH).map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX))
}

pub fn now_millis() -> u64 {
    millis(SystemTime::now())
}
