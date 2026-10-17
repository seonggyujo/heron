// Mouse and keyboard for a recording, sent through CDP into the page only.
// Nothing moves Windows' own cursor or types on its keyboard, so the PC stays
// usable while a scene records. A drawn pointer shows where the mouse is.

import { setTimeout as sleep } from "node:timers/promises";

// A white arrow with a dark outline, its tip at (1, 1).
const ARROW =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="22">' +
      '<path d="M1 1v17l4.5-4.2 3 6.6 2.6-1.2-3-6.4h6.2z" fill="#fff" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  );

const DRAW_POINTER = `window.__demoPointer = (x, y) => {
  let el = document.getElementById("demo-pointer");
  if (!el) {
    el = document.createElement("div");
    el.id = "demo-pointer";
    el.style.cssText = "position:fixed;left:-1px;top:-1px;width:20px;height:22px;pointer-events:none;z-index:2147483647;background:url('${ARROW}')";
    document.documentElement.append(el);
  }
  el.style.transform = "translate(" + x + "px," + y + "px)";
}`;

export function createInput(cdp) {
  let x = 600;
  let y = 420;
  let held = false;

  const mouse = (type, extra = {}) =>
    cdp.send("Input.dispatchMouseEvent", { type, x, y, button: held ? "left" : "none", buttons: held ? 1 : 0, ...extra });
  const showPointer = () => cdp.js(`(${DRAW_POINTER}, __demoPointer(${x}, ${y}))`);

  /** Center of the index-th match of `selector`, or a point at (fx, fy) of its box. */
  async function at(selector, index = 0, fx = 0.5, fy = 0.5) {
    const box = await cdp.js(
      `(() => { const r = document.querySelectorAll(${JSON.stringify(selector)})[${index}]?.getBoundingClientRect();` +
        ` return r && [r.x + r.width * ${fx}, r.y + r.height * ${fy}]; })()`,
    );
    if (!box) throw new Error(`nothing matches ${selector} [${index}]`);
    return box.map(Math.round);
  }

  /** Glides there with an ease-out, like a hand would. */
  async function move([tx, ty], ms = 280) {
    const [sx, sy] = [x, y];
    const steps = Math.max(1, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const e = 1 - (1 - i / steps) ** 3;
      x = Math.round(sx + (tx - sx) * e);
      y = Math.round(sy + (ty - sy) * e);
      await mouse("mouseMoved");
      await showPointer();
      await sleep(16);
    }
  }

  async function press(clickCount = 1) {
    held = true;
    await mouse("mousePressed", { clickCount });
  }

  async function release(clickCount = 1) {
    held = false;
    await mouse("mouseReleased", { button: "left", clickCount });
  }

  async function click(point) {
    await move(point);
    await sleep(120);
    await press();
    await sleep(40);
    await release();
  }

  async function doubleClick(point) {
    await move(point);
    await sleep(120);
    for (const n of [1, 2]) {
      await press(n);
      await sleep(40);
      await release(n);
      await sleep(70);
    }
  }

  /** Press at `from`, glide to `to`, release. The button is always released. */
  async function drag(from, to, ms = 900) {
    await move(from);
    await sleep(150);
    await press();
    try {
      await move(to, ms);
      await sleep(350);
    } finally {
      await release();
    }
  }

  /** Types into whatever has focus, one character at a time. */
  async function type(text, delayMs = 45) {
    for (const ch of text) {
      await cdp.send("Input.insertText", { text: ch });
      await sleep(delayMs);
    }
  }

  async function key(keyName, code, keyCode, { text, modifiers = 0 } = {}) {
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: keyName, code, windowsVirtualKeyCode: keyCode, text, modifiers });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, windowsVirtualKeyCode: keyCode, modifiers });
  }

  const enter = () => key("Enter", "Enter", 13, { text: "\r" });
  /** Ctrl + a letter, e.g. ctrl("c"). */
  const ctrl = (letter) => key(letter, `Key${letter.toUpperCase()}`, letter.toUpperCase().charCodeAt(0), { modifiers: 2 });

  return { at, move, click, doubleClick, drag, type, enter, ctrl };
}
