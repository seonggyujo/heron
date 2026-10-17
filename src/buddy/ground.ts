// Where a heron may stand in a terminal: runs of blank cells, a few rows
// tall, in what the terminal shows now. Which cells are blank is the
// screen's call (pane/heron-screen.ts reads xterm). Pure.

export interface Screen {
  readonly cols: number;
  readonly rows: number;
  /** Mid-frame (synchronized output): the screen may be half redrawn. */
  readonly synchronized: boolean;
  /** No character, the default background, nothing drawn on it, not at the cursor. */
  blank(col: number, row: number): boolean;
}

/** Free columns [c0, c1) in the rows that end at row (the heron's feet stand on row's lower edge). */
export interface Spot {
  row: number;
  c0: number;
  c1: number;
}

/**
 * home: the lowest run, the rightmost one on a tie.
 * near: the run closest to (col, row).
 * any:  the pick-th run, counting round.
 */
export type FindMode = "home" | "near" | "any";

export function groundFree(s: Screen, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < s.cols && row < s.rows && s.blank(col, row);
}

/** Column col is free in the h rows ending at row. */
function columnFree(s: Screen, col: number, row: number, h: number): boolean {
  for (let y = row - h + 1; y <= row; y++) {
    if (!groundFree(s, col, y)) return false;
  }
  return true;
}

/** The run through columns [col0, col1] of the h rows ending at row; null when any of those cells is taken. */
export function groundRun(s: Screen, row: number, h: number, col0: number, col1: number): Spot | null {
  if (row - h + 1 < 0 || row >= s.rows || col0 < 0 || col1 >= s.cols) return null;
  for (let c = col0; c <= col1; c++) {
    if (!columnFree(s, c, row, h)) return null;
  }
  let c0 = col0;
  let c1 = col1 + 1;
  while (c0 > 0 && columnFree(s, c0 - 1, row, h)) c0--;
  while (c1 < s.cols && columnFree(s, c1, row, h)) c1++;
  return { row, c0, c1 };
}

/** Every run at least w wide and h tall, top to bottom, left to right. */
function eachRun(s: Screen, w: number, h: number, take: (spot: Spot) => void): void {
  for (let row = h - 1; row < s.rows; row++) {
    let c = 0;
    while (c < s.cols) {
      while (c < s.cols && !columnFree(s, c, row, h)) c++;
      const start = c;
      while (c < s.cols && columnFree(s, c, row, h)) c++;
      if (c - start >= w) take({ row, c0: start, c1: c });
    }
  }
}

/** A run at least w columns wide and h rows tall; ties go to the lower, then the righter run. */
export function groundFind(s: Screen, w: number, h: number, mode: FindMode, col: number, row: number, pick: number): Spot | null {
  let seen = 0;
  if (mode === "any") {
    eachRun(s, w, h, () => seen++);
    if (!seen) return null;
    pick %= seen;
    seen = 0;
  }
  // How far a heron at (col, row) goes to stand in a run; a row is about two columns high.
  const distance = (spot: Spot) => {
    const last = spot.c1 - w;
    const dc = col < spot.c0 ? spot.c0 - col : col > last ? col - last : 0;
    return Math.abs(spot.row - row) * 2 + dc;
  };
  let best: Spot | null = null;
  let bestScore = 0;
  eachRun(s, w, h, (spot) => {
    if (mode === "any" && seen++ !== pick) return;
    const score = mode === "home" ? spot.row : mode === "near" ? -distance(spot) : 1;
    if (!best || score >= bestScore) {
      best = spot;
      bestScore = score;
    }
  });
  return best;
}
