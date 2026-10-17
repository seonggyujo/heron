// Small path helpers: a folder's last name, whether Claude Code made it as
// a worktree, and the name to show for it.

/** A folder in a worktree Claude Code made: `<repo>\.claude\worktrees\<name>\...`. */
const WORKTREE = /^(.*?)[\\/]\.claude[\\/]worktrees[\\/]([^\\/]+)/;

/** Last folder of a Windows or Unix path: "C:\Users\me\app" → "app", "C:\" → "C:". */
export function folderName(path: string): string | null {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? null;
}

/** Inside a worktree of `claude --worktree`. */
export const inWorktree = (path: string): boolean => WORKTREE.test(path);

/** The name to show for a folder: "heron", or "heron · fix-login" for that worktree of heron. */
export function folderLabel(path: string): string | null {
  const worktree = WORKTREE.exec(path);
  if (!worktree) return folderName(path);
  return `${folderName(worktree[1]) ?? worktree[1]} · ${worktree[2]}`;
}
