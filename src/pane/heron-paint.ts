import type { PoseItem } from "../buddy/crew-pose";
import { spriteOf } from "../buddy/sprites";

// Drawing a crew's pose (buddy/crew-pose.ts) on a canvas in the theme's
// colors: every sprite pixel is a square with its edges on whole device
// pixels, so neighbors meet without seams, and a row's run of one color is
// one rectangle. The body and the marks take the theme's tokens
// (styles/themes.css); eye, beak, chicks, sparks and the twig keep their
// own colors.

const FIXED: Record<string, string> = { K: "#1b2420", Y: "#e2b04a", C: "#f2d46b", S: "#ffe9a0", T: "#a07a48" };
const TOKENS: Record<string, string> = { W: "--fg-soft", G: "--fg-dim", Z: "--fg-dim", N: "--agent-need" };

let inkTheme: string | undefined;
let inks: Record<string, string> = {};

/** The letters of buddy/sprites.ts as colors, read again when the theme changes. */
function inkOf(letter: string): string | undefined {
  const theme = document.documentElement.dataset.theme ?? "green";
  if (theme !== inkTheme) {
    const css = getComputedStyle(document.documentElement);
    inks = { ...FIXED };
    for (const [l, token] of Object.entries(TOKENS)) inks[l] = css.getPropertyValue(token).trim();
    inkTheme = theme;
  }
  return inks[letter];
}

function paintItem(ctx: CanvasRenderingContext2D, item: PoseItem, px: number): void {
  const s = spriteOf(item.sprite);
  const left = item.x * px;
  const top = item.y * px;
  ctx.globalAlpha = item.opacity;
  for (let r = 0; r < s.h; r++) {
    const row = s.rows[r];
    const y0 = Math.round(top + r * px);
    const y1 = Math.round(top + (r + 1) * px);
    // v: the column as drawn, mirrored when the sprite faces left.
    const at = (v: number) => row[item.flip ? s.w - 1 - v : v];
    let v = 0;
    while (v < s.w) {
      const letter = at(v);
      const start = v;
      while (v < s.w && at(v) === letter) v++;
      const ink = letter === "." ? undefined : inkOf(letter);
      if (!ink) continue;
      const x0 = Math.round(left + start * px);
      ctx.fillStyle = ink;
      ctx.fillRect(x0, y0, Math.round(left + v * px) - x0, y1 - y0);
    }
  }
  ctx.globalAlpha = 1;
}

/** Positions are in sprite pixels from the canvas's top-left; px is one sprite pixel in device pixels. */
export function paintPose(ctx: CanvasRenderingContext2D, items: readonly PoseItem[], px: number): void {
  for (const item of items) paintItem(ctx, item, px);
}
