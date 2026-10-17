import type { ShellKind } from "../ipc/pty";
import { pref } from "./prefs";

// Shell names and the remembered default for the + button.

export const SHELL_LABELS: Record<ShellKind, string> = {
  pwsh: "pwsh",
  powershell: "PowerShell",
  cmd: "cmd",
  gitbash: "Git Bash",
};

const shellKind = (raw: string) => (Object.keys(SHELL_LABELS).includes(raw) ? (raw as ShellKind) : undefined);

/** The shell the user picked in the + button's menu, if any. */
export const defaultShellPref = pref<ShellKind | null>("heron.defaultShell", null, shellKind);

/** The picked shell if still installed, else the first installed shell. */
export function defaultShellOf(available: ShellKind[]): ShellKind {
  const picked = defaultShellPref.get();
  return picked && available.includes(picked) ? picked : (available[0] ?? "powershell");
}
