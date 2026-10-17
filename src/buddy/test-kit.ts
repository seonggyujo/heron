import { crewUpdate } from "./crew";
import { crewPose } from "./crew-pose";
import type { Crew, CrewInput } from "./crew-state";
import type { Screen } from "./ground";
import type { SpriteId } from "./sprites";

// For the buddy tests only (*.test.ts): a terminal grid to put text on, and
// helpers that run a crew frame by frame. The app never imports it.

/** A cell is taken by a character; the cursor, when shown, and two cells after it are taken. */
export class FakeScreen implements Screen {
  cells: string[][];
  cursor = { row: 0, col: 0, shown: false };
  synchronized = false;

  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.cells = Array.from({ length: rows }, () => Array<string>(cols).fill(""));
  }

  put(row: number, col: number, text: string): void {
    for (const ch of text) {
      if (col >= this.cols) {
        col = 0;
        row++;
      }
      if (row >= this.rows) break;
      this.cells[row][col++] = ch;
    }
  }

  fillRows(first: number, last: number): void {
    for (let r = first; r <= last; r++) this.put(r, 0, "x".repeat(this.cols));
  }

  clear(): void {
    this.cells.forEach((r) => r.fill(""));
  }

  blank(col: number, row: number): boolean {
    const c = this.cursor;
    if (c.shown && row === c.row && col >= c.col && col <= c.col + 2) return false;
    return this.cells[row][col] === "";
  }
}

/** One cell in sprite pixels, as in a 14 px terminal font. */
export const CELL = { w: 3.3, h: 7.0 };

export const crewInput = (screen: Screen, over: Partial<CrewInput> = {}): CrewInput => ({
  screen,
  present: true,
  state: "working",
  doing: null,
  subagents: 0,
  cellW: CELL.w,
  cellH: CELL.h,
  ...over,
});

/** Runs the crew for `ms`, a frame (33 ms) at a time. */
export function runCrew(c: Crew, input: CrewInput, clock: { now: number }, ms: number): void {
  for (let t = 0; t < ms; t += 33) {
    clock.now += 33;
    crewUpdate(c, input, clock.now);
  }
}

/** How many of these sprites the crew shows now. */
export const countPose = (c: Crew, now: number, ids: SpriteId[]): number =>
  crewPose(c, now).filter((item) => ids.includes(item.sprite)).length;
