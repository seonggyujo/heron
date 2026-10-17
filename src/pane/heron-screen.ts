import type { IBufferCell, IBufferLine, Terminal } from "@xterm/xterm";
import type { Screen } from "../buddy/ground";

// What an xterm terminal shows now, as the terminal herons see it
// (buddy/ground.ts). A cell is blank when it has no character (or a
// space), the default background, and no inverse, underline or strike.
// The cursor and the two cells after it are kept clear for what is being
// typed; xterm does not say whether the cursor is hidden, so they always
// are while the view is at the bottom.

/** Cells after the cursor kept clear. */
const CURSOR_ROOM = 2;

export class HeronScreen implements Screen {
  cols = 0;
  rows = 0;
  synchronized = false;
  /** The lines in view, read when first asked for (null: no line there). */
  private lines: (IBufferLine | null)[] = [];
  private cell: IBufferCell | undefined;
  private cursorCol = -1;
  private cursorRow = -1;
  private readonly term: Terminal;

  constructor(term: Terminal) {
    this.term = term;
  }

  /** Takes what the terminal shows now; call before each step of the herons. */
  refresh(): void {
    const buffer = this.term.buffer.active;
    this.cols = this.term.cols;
    this.rows = this.term.rows;
    this.synchronized = this.term.modes.synchronizedOutputMode;
    this.lines = [];
    const atBottom = buffer.viewportY === buffer.baseY;
    this.cursorRow = atBottom ? buffer.cursorY : -1;
    this.cursorCol = buffer.cursorX;
  }

  blank(col: number, row: number): boolean {
    if (row === this.cursorRow && col >= this.cursorCol && col <= this.cursorCol + CURSOR_ROOM) return false;
    let line = this.lines[row];
    if (line === undefined) {
      const buffer = this.term.buffer.active;
      line = this.lines[row] = buffer.getLine(buffer.viewportY + row) ?? null;
    }
    const cell = line?.getCell(col, this.cell);
    if (!cell) return true;
    this.cell = cell;
    const ch = cell.getChars();
    // Width 2 is a wide character, 0 its second half.
    if (cell.getWidth() !== 1 || (ch && ch !== " ")) return false;
    return cell.isBgDefault() && !cell.isInverse() && !cell.isUnderline() && !cell.isStrikethrough();
  }
}
