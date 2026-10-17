import type { Fittable } from "../layout/fit-scheduler";

// What the layout and dragging need from a pane (pane.ts), so they do not
// depend on the terminal itself.

export interface PaneItem extends Fittable {
  readonly el: HTMLElement;
  /** The header, where a drag to move the pane starts. */
  readonly handle: HTMLElement;
  /** For logs, e.g. "pty 3". */
  readonly name: string;
  /** The shell is alive. */
  readonly running: boolean;
  setFontSize(px: number): void;
  setFocused(focused: boolean): void;
  focus(): void;
  /** Types text into the shell, e.g. dropped file paths. */
  paste(text: string): void;
  enter(): void;
  leave(): Promise<void>;
  dispose(): void;
}
