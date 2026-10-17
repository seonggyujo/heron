import { span } from "../app/dom";
import { createLogger } from "../app/log";
import { folderName } from "../app/paths";
import { t } from "../i18n/lang";
import { createPopover } from "./popover";

// The folder menu of "New agent" (its ▾): one row per folder with its name
// and path, and a click starts Claude Code there. A folder in a git
// repository also gets "worktree", which starts the agent in a new worktree
// with a branch of its own (`claude --worktree`). "Choose a folder…" at the
// bottom opens the folder picker. Opening and closing is popover.ts.

const log = createLogger("agent-menu");

export interface FolderMenuActions {
  start(folder: string, worktree: boolean): void;
  pick(): void;
  /** For each folder, whether it is in a git repository. */
  repos(folders: string[]): Promise<boolean[]>;
}

export interface AgentFolderMenu {
  el: HTMLElement;
  /** Opens under `anchor` with `folders`, or closes when open. */
  toggle(anchor: HTMLElement, folders: string[]): void;
}

function button(className: string, text = ""): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.textContent = text;
  return el;
}

export function createAgentFolderMenu(actions: FolderMenuActions): AgentFolderMenu {
  const el = document.createElement("div");
  el.className = "agent-folder-menu";
  el.setAttribute("role", "menu");
  let folders: string[] = [];
  let worktrees: HTMLButtonElement[] = [];
  const popover = createPopover(el, () => draw(), "left");
  const choose = (fn: () => void) => () => {
    popover.close();
    fn();
  };

  const folderRow = (folder: string): HTMLElement => {
    const row = document.createElement("div");
    row.className = "folder-row";
    const start = button("folder-start");
    start.setAttribute("role", "menuitem");
    start.append(span("folder-name", folderName(folder) ?? folder), span("folder-path", folder));
    start.title = t().newAgentIn(folder);
    start.addEventListener("click", choose(() => actions.start(folder, false)));
    const worktree = button("folder-worktree", "worktree");
    worktree.setAttribute("role", "menuitem");
    worktree.title = t().worktreeHint(folderName(folder) ?? folder);
    worktree.hidden = true;
    worktree.addEventListener("click", choose(() => actions.start(folder, true)));
    worktrees.push(worktree);
    row.append(start, worktree);
    return row;
  };

  const draw = () => {
    const head = document.createElement("div");
    head.className = "folder-menu-head";
    head.textContent = t().agentFolders;
    worktrees = [];
    const rows = folders.map(folderRow);
    const pick = button("folder-pick", t().pickFolder);
    pick.setAttribute("role", "menuitem");
    pick.addEventListener("click", choose(actions.pick));
    el.replaceChildren(head, ...rows, pick);
    // "worktree" shows once git has answered, if the menu still lists these folders.
    const shown = worktrees;
    actions.repos(folders).then(
      (repos) => shown === worktrees && shown.forEach((w, i) => (w.hidden = !repos[i])),
      (err) => log.warn("git check failed", err),
    );
  };

  return {
    el,
    toggle(anchor, next) {
      folders = next;
      popover.toggle(anchor);
    },
  };
}
