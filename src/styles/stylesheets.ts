// Every stylesheet of the app, in cascade order: xterm first, then the
// theme tokens and base rules, then one file per feature. A later file wins
// over an earlier one at the same specificity.

import "@xterm/xterm/css/xterm.css";
import "./themes.css";
import "./base.css";
import "./titlebar.css";
import "./controls.css";
import "./shell-menu.css";
import "./workspace.css";
import "./pane.css";
import "./split.css";
import "./settings.css";
import "./empty-state.css";
import "./agent-sidebar.css";
import "./agent-item.css";
import "./agent-activity.css";
import "./agent-tokens.css";
import "./subagent-lines.css";
import "./new-agent.css";
import "./agent-folder-menu.css";
import "./recent-sessions.css";
import "./recent-group-head.css";
import "./recent-session-row.css";
import "./agent-marks.css";
import "./usage-bar.css";
import "./agent-hints.css";
import "./effects.css";
