//! The shells Heron offers (PowerShell 7, Windows PowerShell, cmd, Git
//! Bash): which are installed, and the command that starts each.

use std::env;
use std::path::{Path, PathBuf};

use portable_pty::CommandBuilder;
use serde::{Deserialize, Serialize};

use super::cwd_report;

/// Shells offered in the "new terminal" menu.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ShellKind {
    /// PowerShell 7+.
    Pwsh,
    /// Windows PowerShell 5.1, built into Windows.
    PowerShell,
    Cmd,
    GitBash,
}

const ALL: [ShellKind; 4] = [
    ShellKind::Pwsh,
    ShellKind::PowerShell,
    ShellKind::Cmd,
    ShellKind::GitBash,
];

impl ShellKind {
    /// Shells installed on this machine, in menu order.
    pub fn available() -> Vec<ShellKind> {
        ALL.into_iter().filter(|s| s.program().is_some()).collect()
    }

    fn program(self) -> Option<PathBuf> {
        match self {
            ShellKind::Pwsh => find_in_path("pwsh.exe")
                .or_else(|| existing(r"C:\Program Files\PowerShell\7\pwsh.exe")),
            ShellKind::PowerShell => find_in_path("powershell.exe"),
            ShellKind::Cmd => env::var_os("ComSpec")
                .map(PathBuf::from)
                .or_else(|| find_in_path("cmd.exe")),
            ShellKind::GitBash => git_bash(),
        }
    }

    /// Builds the command line for this shell, starting in `cwd` when it is
    /// an existing folder, else in the user's home. The environment is
    /// passed through; the only addition is the invisible current-folder
    /// report (see cwd_report.rs).
    pub fn command(self, cwd: Option<&Path>) -> Result<CommandBuilder, String> {
        let program = self
            .program()
            .ok_or_else(|| format!("{self:?} is not installed"))?;
        let mut cmd = CommandBuilder::new(program);
        match self {
            ShellKind::Pwsh | ShellKind::PowerShell => cmd.arg("-NoLogo"),
            ShellKind::GitBash => cmd.args(["--login", "-i"]),
            ShellKind::Cmd => {}
        }
        cwd_report::apply(self, &mut cmd);
        match cwd.filter(|dir| dir.is_dir()) {
            Some(dir) => cmd.cwd(dir),
            None => {
                if let Some(home) = env::var_os("USERPROFILE") {
                    cmd.cwd(home);
                }
            }
        }
        Ok(cmd)
    }
}

fn git_bash() -> Option<PathBuf> {
    // git.exe lives in <root>\cmd, bash.exe in <root>\bin.
    find_in_path("git.exe")
        .and_then(|git| Some(git.parent()?.parent()?.join(r"bin\bash.exe")))
        .filter(|p| p.is_file())
        .or_else(|| existing(r"C:\Program Files\Git\bin\bash.exe"))
}

fn find_in_path(exe: &str) -> Option<PathBuf> {
    env::split_paths(&env::var_os("PATH")?)
        .map(|dir| dir.join(exe))
        .find(|p| p.is_file())
}

fn existing(path: &str) -> Option<PathBuf> {
    Path::new(path).is_file().then(|| PathBuf::from(path))
}
