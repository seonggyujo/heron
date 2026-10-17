// Records the README GIFs: starts the demo app (app.js), films each scene
// into rec/<scene>/ (capture.js), and stops the app. Then make-gifs.js.
//   node scripts/demo/record.js                     every scene
//   node scripts/demo/record.js split,settings      only these
// The app is driven and filmed through its DevTools port only, so the PC
// stays usable meanwhile.

import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { AGENT_SCENES } from "./agents.js";
import { PORT, SIZE, startApp } from "./app.js";
import { startCapture } from "./capture.js";
import { connect } from "./cdp.js";
import { createInput } from "./input.js";
import { REC_DIR } from "./paths.js";
import { SCENES } from "./scenes.js";
import { createStage } from "./stage.js";

const ALL = { ...AGENT_SCENES, ...SCENES };
const names = process.argv[2]?.split(",") ?? Object.keys(ALL);
const unknown = names.filter((n) => !ALL[n]);
if (unknown.length) throw new Error(`no scene ${unknown.join(", ")}; scenes: ${Object.keys(ALL).join(", ")}`);

// The two hints at the bottom of the sidebar are about this app's own
// (empty) Claude Code config, not about the sessions filmed.
const PREFS = { "heron.hooksOfferHidden": "true", "heron.pluginHintHidden": "true" };

async function openPage() {
  const cdp = await connect(PORT);
  await cdp.send("Page.enable");
  await cdp.waitFor(`document.querySelectorAll(".pane").length > 0`, 120_000);
  await cdp.js(`Object.entries(${JSON.stringify(PREFS)}).forEach(([k, v]) => localStorage.setItem(k, v))`);
  await cdp.send("Page.reload");
  await sleep(1000);
  await cdp.waitFor(`document.readyState === "complete" && document.querySelectorAll(".pane").length > 0`, 60_000);
  // Drawn as the focused window (solid cursor, active title bar), never taking focus.
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  const size = await cdp.js("[innerWidth, innerHeight, devicePixelRatio].join('x')");
  if (size !== `${SIZE.width}x${SIZE.height}x1`) console.warn(`page is ${size}, expected ${SIZE.width}x${SIZE.height} at 1x`);
  return cdp;
}

const app = startApp();
try {
  const cdp = await openPage();
  const ui = createInput(cdp);
  const stage = createStage(cdp, ui);
  for (const name of Object.keys(ALL).filter((n) => names.includes(n))) {
    const scene = ALL[name];
    await scene.prepare(stage, ui);
    await stage.park();
    const stop = await startCapture(cdp, path.join(REC_DIR, name));
    await sleep(500);
    await scene.run(stage, ui);
    await sleep(600);
    console.log(`recorded ${name}: ${await stop()} frames`);
  }
} finally {
  app.stop();
}
