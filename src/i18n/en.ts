// Every string the app shows, in English. The Korean table (ko.ts) must
// have the same keys. Shell names (PowerShell, Git Bash, ...) and log
// messages are not translated.

export const en = {
  // Title bar
  minimize: "Minimize",
  maximize: "Maximize",
  close: "Close",
  newTerminal: "New terminal",
  chooseShell: "Choose shell",
  tidy: "Back to automatic grid",
  running: (n: number) => `${n} running`,
  runningOf: (n: number, total: number) => `${n} / ${total} running`,

  // Empty state
  emptyCaption: "new terminal",

  // Pane header
  closeTerminal: "Close terminal",
  exitCode: (code: number) => `exit ${code}`,
  failedToStart: "failed to start",

  // Settings
  settings: "Settings",
  theme: "Theme",
  themeGreen: "Green theme",
  themeBlack: "Black theme",
  language: "Language",
  fontSize: "Font size",
  fontSmaller: "Smaller font",
  fontLarger: "Larger font",
  animations: "Animations",
  herons: "Terminal herons",
  heronsOff: "Off",
  heronsHint:
    "How many herons live in the empty space of each Claude Code pane. While the agent works they act out what it does: " +
    "peck while it reads, carry a twig while it edits, run while a command runs, fly about on the web, stand still to think. " +
    "They call with ! or ? when it needs you, cheer when it is done and sleep when idle. Each running subagent brings a chick. " +
    "Drawn over blank cells only",
  closeOnExit: "Close pane on exit 0",
  closeOnExitHint: "Close pane when the shell exits cleanly",
  restoreWorkspace: "Reopen last work",
  restoreWorkspaceHint: "On start, reopen the last run's panes in their folders and layout, and resume the Claude Code sessions in them",
  agentHooks: "Claude Code hooks",
  agentHooksHint: "Show permission requests, questions and model checks in the sidebar. Adds Heron's hooks to Claude Code's settings.json",
  reset: "Reset",
  resetHint: "Theme, font size, language and the options above, except Claude Code hooks",
  sure: "Sure?",
  done: "Done",

  // Agent sidebar
  agents: "Agents",
  collapse: "Collapse",
  expand: "Expand",
  agentIdle: "idle",
  agentWorking: "working",
  agentPermission: "needs permission",
  agentQuestion: "has a question",
  agentWaiting: "waiting for you",
  agentDone: "done",
  doingThink: "thinking",
  doingWrite: "writing",
  doingRead: (what: string) => `reading ${what}`,
  doingSearch: (what: string) => `searching ${what}`,
  doingEdit: (what: string) => `editing ${what}`,
  doingRun: (what: string) => `running ${what}`,
  doingWeb: (what: string) => `browsing ${what}`,
  doingAgent: (what: string) => `delegating ${what}`,
  doingTool: (what: string) => `using ${what}`,
  turnTools: (n: number) => (n === 1 ? "1 tool this turn" : `${n} tools this turn`),
  tokens: (total: string, turn: string) => `${total} tokens · ${turn} this turn`,
  tokensSession: "Session",
  tokensSessionCounting: "Session (still counting the earlier part)",
  tokensTurn: "This turn",
  tokenKinds: (input: string, output: string, write: string, read: string) =>
    `input ${input} · output ${output} · cache write ${write} · cache read ${read}`,
  agentMismatch: (selected: string, actual: string) => `Selected ${selected}, answered by ${actual}`,
  agentPluginHint: "Install the heron-limits plugin to see usage limits and context use",
  hooksOffer: "See permission requests, questions and model checks too: Heron adds its hooks to Claude Code's settings.json.",
  hooksTurnOn: "Turn on",
  hooksTurningOn: "Turning on…",
  hooksNoClaude: "Claude Code was not found. Check that claude runs in a terminal.",
  hooksOldClaude: (version: string) => `Needs Claude Code 2.1.139 or later (found ${version}).`,
  hooksBadSettings: "Claude Code's settings.json is not valid JSON, so it was left alone.",
  hooksFailed: "Could not change Claude Code's settings.",
  hide: "Hide",
  newAgent: "New agent",
  newAgentIn: (folder: string) => `Start Claude Code in a new pane, in ${folder}`,
  chooseAgentFolder: "Choose the folder",
  agentFolders: "Start a new agent in",
  worktreeHint: (folder: string) => `Start in a new git worktree of ${folder}: a folder and a branch of its own`,
  pickFolder: "Choose a folder…",
  uncommitted: (files: number) => (files === 1 ? "1 file with uncommitted changes" : `${files} files with uncommitted changes`),
  moreSubagents: (n: number) => `+${n} more`,
  noAgents: "No agent running",
  recentSessions: "Recent sessions",
  recentHint: "Click to resume",
  resume: "Resume",
  justNow: "just now",
  moreAbove: (n: number) => `↑ ${n} more`,
  moreBelow: (n: number) => `↓ ${n} more`,
  deleteHint: "Right-click to delete (to the Recycle Bin)",
  deleteAsk: "Delete?",
  deleteYes: "Delete",
  deleteNo: "Cancel",
  deleteRunning: "It runs in another terminal",
  deleteFailed: "Could not delete it",

  // Usage bar
  limitFiveHour: "5-hour limit",
  limitWeekly: "Weekly limit",
  limitResets: (left: string) => `resets in ${left}`,
  context: "Context",
  contextUsed: (folder: string, percent: number) => `${folder}: ${percent}% of the context window used`,
};

export type Strings = typeof en;
