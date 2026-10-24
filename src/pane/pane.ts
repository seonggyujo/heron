import type { Agent } from "../agent/agent-model";
import { createLogger } from "../app/log";
import { folderName } from "../app/paths";
import { SHELL_LABELS } from "../app/shells";
import type { UptimeClock } from "../app/uptime-clock";
import type { ShellKind } from "../ipc/pty";
import type { PaneDoing } from "./pane-header";
import type { PaneItem } from "./pane-item";
import { animateEnter, animateLeave } from "./pane-motion";
import { createPaneParts, type PaneParts } from "./pane-parts";
import type { PaneSignal } from "./pane-signals";

// One pane: its parts (frame, xterm view, PTY link, glow, terminal herons;
// built in pane-parts.ts) behind what the rest of the app asks of a pane.
// The constructor only builds DOM; start() spawns the shell once the pane
// is laid out in the grid, so the first PTY size is already right.

const log = createLogger("pane");

export interface PaneOptions {
  shell: ShellKind;
  /** Folder to start in; null = home. */
  cwd: string | null;
  fontSize: number;
  clock: UptimeClock;
  onClose(pane: Pane): void;
  onFocus(pane: Pane): void;
  /** Title, prompt and key signals for the agent board. */
  onSignal(pane: Pane, signal: PaneSignal): void;
  /** Typed into the shell at its first prompt (start-command.ts). */
  run?: string;
}

export class Pane implements PaneItem {
  readonly el: HTMLElement;
  readonly shell: ShellKind;
  private readonly cwd: string | null;
  private readonly parts: PaneParts;

  constructor(parent: HTMLElement, opts: PaneOptions) {
    this.shell = opts.shell;
    this.cwd = opts.cwd;
    this.parts = createPaneParts(parent, opts, {
      name: () => this.name,
      close: () => opts.onClose(this),
      focus: () => this.focus(),
      signal: (s) => opts.onSignal(this, s),
    });
    this.el = this.parts.el;
    this.el.addEventListener("focusin", () => opts.onFocus(this));
  }

  async start(): Promise<void> {
    const { cols, rows } = this.parts.view.fit() ?? { cols: 80, rows: 24 };
    try {
      await this.parts.link.spawn(this.shell, cols, rows, this.cwd);
      this.parts.header.startUptime();
    } catch (err) {
      log.error(`spawn ${this.shell} failed`, err);
      this.markExited(null);
    }
  }

  get id(): number | null {
    return this.parts.link.id;
  }

  get name(): string {
    return `pty ${this.parts.link.id}`;
  }

  get running(): boolean {
    return this.parts.link.running;
  }

  /** The folder the shell is in, as far as known; null = home. */
  get path(): string | null {
    return this.parts.where() ?? this.cwd;
  }

  /** Last folder name, e.g. "heron"; the shell name until one is known. */
  get folder(): string {
    return folderName(this.path ?? "") ?? SHELL_LABELS[this.shell];
  }

  /** The header, where a drag to move the pane starts (pane-drag.ts). */
  get handle(): HTMLElement {
    return this.parts.header.el;
  }

  fit(): void {
    const size = this.parts.view.fit();
    if (size) this.parts.link.resize(size.cols, size.rows);
  }

  setFontSize(px: number): void {
    this.parts.view.setFontSize(px);
  }

  /** The coding agent in this pane, null for none: its herons act it out, the header says what it does. */
  showAgent(agent: Agent | null, doing: PaneDoing | null): void {
    this.parts.herons.show(agent);
    this.parts.header.setDoing(doing);
  }

  /** The git branch of the folder in the header; null outside a repository. */
  showBranch(branch: string | null): void {
    this.parts.header.setBranch(branch);
  }

  setFocused(focused: boolean): void {
    this.el.classList.toggle("focused", focused);
  }

  focus(): void {
    this.parts.view.focus();
  }

  /** Types text into the shell as a paste (bracketed paste when enabled). */
  paste(text: string): void {
    this.parts.view.paste(text);
    this.focus();
  }

  /** The shell ended with `code`; null = it never started. */
  markExited(code: number | null): void {
    if (code !== null) log.info(`pty ${this.id} exited with code ${code}`);
    this.parts.link.markClosed();
    this.el.classList.add("exited");
    this.parts.header.showExit(code);
  }

  enter(): void {
    animateEnter(this.el);
  }

  leave(): Promise<void> {
    return animateLeave(this.el);
  }

  dispose(): void {
    const { link, glow, herons, header, view } = this.parts;
    link.kill();
    glow.dispose();
    herons.dispose();
    header.dispose();
    view.dispose();
    this.el.remove();
  }
}
