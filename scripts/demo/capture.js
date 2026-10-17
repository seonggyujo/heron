// Films the page through CDP's screencast: a PNG each time the page paints,
// with the time it appeared, into a folder with frames.json. make-gifs.js
// turns that folder into a GIF.

import fs from "node:fs";
import path from "node:path";

export async function startCapture(cdp, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  const off = cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = `f${String(frames.length).padStart(5, "0")}.png`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(data, "base64"));
    frames.push({ file, time: metadata.timestamp });
    // The next frame comes only after this one is acknowledged.
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });

  /** Ends the recording; returns how many frames it has. */
  return async function stop() {
    await cdp.send("Page.stopScreencast");
    off();
    fs.writeFileSync(path.join(dir, "frames.json"), JSON.stringify({ frames, end: Date.now() / 1000 }));
    return frames.length;
  };
}
