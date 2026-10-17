// Where the demo scripts read and write, and the ffmpeg they use.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const DEMO_DIR = import.meta.dirname;
export const REPO_DIR = path.resolve(DEMO_DIR, "..", "..");
/** Raw frames and the recording app's files, git-ignored. */
export const REC_DIR = path.join(DEMO_DIR, "rec");
/** The images the READMEs show. */
export const MEDIA_DIR = path.join(REPO_DIR, "docs", "media");

/** ffmpeg or ffprobe from PATH, else where `winget install Gyan.FFmpeg` puts it. */
export function findTool(name) {
  try {
    return execFileSync("where", [`${name}.exe`], { encoding: "utf8" }).split(/\r?\n/)[0];
  } catch {
    const root = path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Packages");
    const pkg = fs.existsSync(root) && fs.readdirSync(root).find((d) => d.startsWith("Gyan.FFmpeg"));
    const build = pkg && fs.readdirSync(path.join(root, pkg)).find((d) => d.startsWith("ffmpeg-"));
    const exe = build && path.join(root, pkg, build, "bin", `${name}.exe`);
    if (exe && fs.existsSync(exe)) return exe;
    throw new Error(`${name} not found. Install it with: winget install Gyan.FFmpeg`);
  }
}
