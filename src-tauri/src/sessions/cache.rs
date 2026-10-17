//! The session summaries read so far, by file. The sidebar asks for the
//! recent sessions on every window focus; a file whose size and last write
//! are unchanged is not read again.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

use super::summary::Summary;
use crate::file_stamp::FileStamp;

/// Each file read so far: how it was then, and its summary.
type Read = HashMap<PathBuf, (FileStamp, Option<Summary>)>;

static SUMMARIES: LazyLock<Mutex<Read>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// The summary of `path` as `read` makes it, read again only when the file changed.
pub fn summary(path: &Path, stamp: FileStamp, read: impl FnOnce() -> Option<Summary>) -> Option<Summary> {
    if let Some((seen, summary)) = SUMMARIES.lock().unwrap().get(path) {
        if *seen == stamp {
            return summary.clone();
        }
    }
    let summary = read();
    SUMMARIES.lock().unwrap().insert(path.to_owned(), (stamp, summary.clone()));
    summary
}

/// Forgets the files that are gone (deleted sessions).
pub fn keep_only<'a>(paths: impl IntoIterator<Item = &'a PathBuf>) {
    let paths: HashSet<&PathBuf> = paths.into_iter().collect();
    SUMMARIES.lock().unwrap().retain(|path, _| paths.contains(path));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_file_again_only_when_it_changed() {
        let path = PathBuf::from("heron-cache-test.jsonl");
        let stamp = FileStamp { len: 10, modified: std::time::SystemTime::UNIX_EPOCH };
        let summary = |title: &str| Some(Summary { cwd: "C:\\x".into(), title: title.into() });
        assert_eq!(super::summary(&path, stamp, || summary("first")).unwrap().title, "first");
        assert_eq!(super::summary(&path, stamp, || summary("second")).unwrap().title, "first", "unchanged: not read");
        let grown = FileStamp { len: 20, ..stamp };
        assert_eq!(super::summary(&path, grown, || summary("third")).unwrap().title, "third");
        keep_only([]);
        assert_eq!(super::summary(&path, grown, || summary("fourth")).unwrap().title, "fourth", "forgotten when gone");
    }
}
