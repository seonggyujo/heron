//! Claude Code's transcript timestamps ("2026-10-10T05:09:03.787Z", always
//! UTC) in ms since the Unix epoch. Pure.

use serde_json::Value;

/// When a transcript entry was written, if it says so.
pub fn entry_time(entry: &Value) -> Option<u64> {
    entry.get("timestamp").and_then(Value::as_str).and_then(iso_millis)
}

/// The UTC form Claude Code writes; None for anything else.
fn iso_millis(ts: &str) -> Option<u64> {
    let b = ts.as_bytes();
    let shape = b.len() >= 20 && b[4] == b'-' && b[7] == b'-' && b[10] == b'T' && b[13] == b':' && b[16] == b':';
    if !shape || !ts.ends_with('Z') {
        return None;
    }
    let num = |from: usize, to: usize| ts.get(from..to)?.parse::<u64>().ok();
    let (year, month, day) = (num(0, 4)?, num(5, 7)?, num(8, 10)?);
    let seconds = num(11, 13)? * 3600 + num(14, 16)? * 60 + num(17, 19)?;
    let millis = match &ts[19..ts.len() - 1] {
        "" => 0,
        fraction => {
            let digits = fraction.strip_prefix('.')?;
            let ms = format!("{:0<3}", digits.get(..3.min(digits.len()))?);
            ms.parse::<u64>().ok()?
        }
    };
    let days = u64::try_from(days_from_civil(year, month, day)).ok()?;
    Some((days * 86_400 + seconds) * 1000 + millis)
}

/// Days since 1970-01-01 (Howard Hinnant's algorithm).
fn days_from_civil(year: u64, month: u64, day: u64) -> i64 {
    let (year, month, day) = (year as i64 - i64::from(month <= 2), month as i64, day as i64);
    let era = year.div_euclid(400);
    let year_of_era = year - era * 400;
    let day_of_year = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_utc_timestamps_only() {
        assert_eq!(iso_millis("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(iso_millis("2000-03-01T00:00:01.5Z"), Some(951_868_801_500));
        assert_eq!(iso_millis("2026-10-10T00:18:30+09:00"), None);
        assert_eq!(iso_millis("yesterday"), None);
    }

    #[test]
    fn reads_the_time_of_an_entry() {
        assert_eq!(entry_time(&serde_json::json!({"timestamp": "1970-01-01T00:00:01Z"})), Some(1000));
        assert_eq!(entry_time(&serde_json::json!({"type": "user"})), None);
    }
}
