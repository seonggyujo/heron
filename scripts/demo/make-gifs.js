// Turns each rec/<scene>/ (capture.js) into docs/media/<scene>.gif with
// ffmpeg: every frame stays as long as it was on screen, resampled to 50 fps
// (the most a GIF can do: browsers slow shorter frame delays down to
// 1/10 s), with one 256-color palette for the whole clip.
//   node scripts/demo/make-gifs.js                  every recorded scene
//   node scripts/demo/make-gifs.js split,settings   only these
// Keep rec/ until the GIFs are approved.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { findTool, MEDIA_DIR, REC_DIR } from "./paths.js";

const FPS = 50;
const ffmpeg = findTool("ffmpeg");
const ffprobe = findTool("ffprobe");

const recorded = fs.existsSync(REC_DIR)
  ? fs.readdirSync(REC_DIR).filter((d) => fs.existsSync(path.join(REC_DIR, d, "frames.json")))
  : [];
const names = process.argv[2]?.split(",") ?? recorded;

/** An ffconcat list that shows each frame until the next one came. */
function frameList(dir) {
  const { frames, end } = JSON.parse(fs.readFileSync(path.join(dir, "frames.json"), "utf8"));
  if (!frames.length) throw new Error(`${dir} has no frames`);
  const lines = ["ffconcat version 1.0"];
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.time ?? end;
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.time).toFixed(4)}`);
  });
  // The concat demuxer applies the last duration only when the file is listed again.
  lines.push(`file '${frames.at(-1).file}'`);
  const list = path.join(dir, "frames.ffconcat");
  fs.writeFileSync(list, lines.join("\n") + "\n");
  return list;
}

fs.mkdirSync(MEDIA_DIR, { recursive: true });
for (const name of names) {
  const dir = path.join(REC_DIR, name);
  if (!recorded.includes(name)) {
    console.log(`skip ${name} (not recorded)`);
    continue;
  }
  const out = path.join(MEDIA_DIR, `${name}.gif`);
  const graph =
    `[0:v]fps=${FPS},split[a][b];` +
    "[a]palettegen=stats_mode=full:max_colors=256[pal];" +
    "[b][pal]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle";
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", frameList(dir), "-filter_complex", graph, out]);
  const seconds = Number(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], { encoding: "utf8" }));
  console.log(`${name}.gif: ${seconds.toFixed(1)} s, ${(fs.statSync(out).size / 2 ** 20).toFixed(2)} MB`);
}
