//! Reading a working tree's HEAD (pure): the branch a HEAD file names, or
//! the commit a detached one is at, and where a linked worktree keeps its
//! HEAD (the `gitdir:` line of its `.git` file).

use std::path::{Path, PathBuf};

/// Characters of a detached HEAD's commit id that are shown.
const SHORT_ID: usize = 7;

/// The branch `ref: refs/heads/<branch>` names, or the short id of the
/// commit a detached HEAD holds. None for anything else, such as the
/// `refs/heads/.invalid` a reftable repository keeps there for old gits.
pub fn branch(head: &str) -> Option<String> {
    let head = head.trim();
    if let Some(name) = head.strip_prefix("ref: refs/heads/") {
        return (!name.is_empty() && name != ".invalid").then(|| name.to_owned());
    }
    let is_id = head.len() >= SHORT_ID && head.bytes().all(|b| b.is_ascii_hexdigit());
    is_id.then(|| head[..SHORT_ID].to_owned())
}

/// The git folder a `.git` file points to (`gitdir: <path>`); a relative
/// path is taken from the working tree's top folder `root`.
pub fn linked_dir(root: &Path, dot_git: &str) -> Option<PathBuf> {
    let dir = dot_git.lines().find_map(|l| l.strip_prefix("gitdir:"))?.trim();
    (!dir.is_empty()).then(|| root.join(dir))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_the_branch_or_the_detached_commit() {
        assert_eq!(branch("ref: refs/heads/main\n").as_deref(), Some("main"));
        assert_eq!(branch("ref: refs/heads/feat/login\n").as_deref(), Some("feat/login"));
        assert_eq!(branch("02791b8f0c6a4d3e5b7a9c1d2e3f4a5b6c7d8e9f\n").as_deref(), Some("02791b8"));
        assert_eq!(branch("ref: refs/heads/.invalid\n"), None);
        assert_eq!(branch("ref: refs/remotes/origin/main\n"), None);
        assert_eq!(branch(""), None);
    }

    #[test]
    fn follows_a_worktree_file_to_its_git_folder() {
        let root = Path::new(r"C:\work\api\.claude\worktrees\fix");
        let absolute = linked_dir(root, "gitdir: C:/work/api/.git/worktrees/fix\n");
        assert_eq!(absolute, Some(PathBuf::from("C:/work/api/.git/worktrees/fix")));
        let relative = linked_dir(root, "gitdir: ../../../.git/worktrees/fix\n");
        assert_eq!(relative, Some(root.join("../../../.git/worktrees/fix")));
        assert_eq!(linked_dir(root, "not a git file"), None);
    }
}
