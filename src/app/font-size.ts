import { pref } from "./prefs";

// Terminal font size shared by every pane, remembered across launches.

export const FONT_MIN = 10;
export const FONT_MAX = 24;
const FONT_DEFAULT = 14;

const inRange = (raw: string) => {
  const px = Number(raw);
  return px >= FONT_MIN && px <= FONT_MAX ? px : undefined;
};

/** Settings > Font size; main.ts applies it to the panes. */
export const fontSizePref = pref("heron.fontSize", FONT_DEFAULT, inRange);

export const clampFontSize = (px: number): number => Math.min(FONT_MAX, Math.max(FONT_MIN, px));
