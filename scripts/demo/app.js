// Starts a dev build of Heron to record, and stops it again:
//   - its own identifier, so its settings and its single-instance lock are
//     apart from an installed Heron (which keeps running untouched)
//   - a DevTools port, through which the scripts drive and film the page
//   - created without focus, so it never takes the keyboard from you
//   - an empty Claude Code config folder (CLAUDE_CONFIG_DIR), so the sidebar
//     shows none of your own sessions. agents.js drops the variable in the
//     panes where it starts Claude Code, which then runs as you.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { REC_DIR, REPO_DIR } from "./paths.js";

export const PORT = 9333;
const IDENTIFIER = "io.github.seonggyujo.heron.demo";
/** The page size, which is also the size of the images. */
export const SIZE = { width: 1200, height: 780 };

const WEBVIEW_ARGS = [
  `--remote-debugging-port=${PORT}`,
  // Keep painting while other windows cover this one.
  "--disable-features=CalculateNativeWinOcclusion",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
];

export function startApp() {
  const conf = JSON.parse(fs.readFileSync(path.join(REPO_DIR, "src-tauri", "tauri.conf.json"), "utf8"));
  const window = { ...conf.app.windows[0], ...SIZE, focus: false };
  const configFile = path.join(REC_DIR, "tauri-demo.json");
  const claudeDir = path.join(REC_DIR, "claude-config");
  // A fresh start: every setting at its default, no panes to reopen.
  fs.rmSync(path.join(process.env.LOCALAPPDATA ?? "", IDENTIFIER), { recursive: true, force: true });
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify({ identifier: IDENTIFIER, app: { windows: [window] } }));

  // Run from inside Claude Code, the scripts inherit its session variables;
  // Claude Code in the panes would take itself for a child session then and
  // keep no transcript (so no activity or tokens in the sidebar).
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^CLAUDE/i.test(k)));
  const log = fs.openSync(path.join(REC_DIR, "app.log"), "w");
  const child = spawn(`npx tauri dev --config "${configFile}"`, {
    cwd: REPO_DIR,
    shell: true,
    stdio: ["ignore", log, log],
    env: { ...env, CLAUDE_CONFIG_DIR: claudeDir, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: WEBVIEW_ARGS.join(" ") },
  });
  return {
    /** Ends the app with everything it started (vite, the shells in its panes). */
    stop() {
      try {
        execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {
        /* already gone */
      }
      fs.closeSync(log);
    },
  };
}
