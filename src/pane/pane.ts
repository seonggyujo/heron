import type { Agent } from "../agent/agent-model";
import { createLogger } from "../app/log";
import { folderName } from "../app/paths";
import { SHELL_LABELS } from "../app/shells";
import type { UptimeClock } from "../app/uptime-clock";
import type { ShellKind } from "../ipc/pty";
import { TerminalView } from "../terminal/terminal-view";
import { OutputGlow } from "./output-glow";
import { createPaneFrame } from "./pane-frame";
import type { PaneHeader } from "./pane-header";
import { PaneHerons } from "./pane-herons";
import type { PaneItem } from "./pane-item";
import { animateEnter, animateLeave } from "./pane-motion";
import { watchPaneTerminal, type PaneSignal } from "./pane-signals";
import { PtyLink } from "./pty-link";
import { typeAtFirstPrompt } from "./start-command";

// One pane = frame (header and terminal box, pane-frame.ts) + xterm view +
// PTY link, with the terminal herons over the view (pane-herons.ts). The
// constructor only builds DOM; start() spawns the shell once the pane is
// laid out in the grid, so the first PTY size is already right.

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
  private readonly header: PaneHeader;
  private readonly view: TerminalView;
  private readonly link: PtyLink;
  private readonly glow: OutputGlow;
  private readonly herons: PaneHerons;
  /** Folder the shell last reported. */
  private readonly where: () => string | null;

  constructor(parent: HTMLElement, opts: PaneOptions) {
    this.shell = opts.shell;
    this.cwd = opts.cwd;
    const frame = createPaneFrame(parent, SHELL_LABELS[opts.shell], opts.clock, () => opts.onClose(this), () => this.focus());
    this.el = frame.el;
    this.header = frame.header;

    this.view = new TerminalView(frame.host, opts.fontSize);
    this.glow = new OutputGlow(this.el);
    this.herons = new PaneHerons(this.view.term, opts.clock);
    this.link = new PtyLink(this.view, () => this.glow.ping());

    const type = (text: string) => this.view.term.input(text, true);
    const emit = typeAtFirstPrompt(opts.run, type, (s) => opts.onSignal(this, s));
    this.where = watchPaneTerminal(this.view.term, () => this.name, this.header, emit);
    this.el.addEventListener("focusin", () => opts.onFocus(this));
  }

  async start(): Promise<void> {
    const { cols, rows } = this.view.fit() ?? { cols: 80, rows: 24 };
    try {
      await this.link.spawn(this.shell, cols, rows, this.cwd);
      this.header.startUptime();
    } catch (err) {
      log.error(`spawn ${this.shell} failed`, err);
      this.markExited(null);
    }
  }

  get id(): number | null {
    return this.link.id;
  }

  get name(): string {
    return `pty ${this.link.id}`;
  }

  get running(): boolean {
    return this.link.running;
  }

  /** The folder the shell is in, as far as known; null = home. */
  get path(): string | null {
    return this.where() ?? this.cwd;
  }

  /** Last folder name, e.g. "heron"; the shell name until one is known. */
  get folder(): string {
    return folderName(this.path ?? "") ?? SHELL_LABELS[this.shell];
  }

  /** The header, where a drag to move the pane starts (pane-drag.ts). */
  get handle(): HTMLElement {
    return this.header.el;
  }

  fit(): void {
    const size = this.view.fit();
    if (size) this.link.resize(size.cols, size.rows);
  }

  setFontSize(px: number): void {
    this.view.setFontSize(px);
  }

  /** The coding agent in this pane, null for none: its herons act it out. */
  showAgent(agent: Agent | null): void {
    this.herons.show(agent);
  }

  setFocused(focused: boolean): void {
    this.el.classList.toggle("focused", focused);
  }

  focus(): void {
    this.view.focus();
  }

  /** Types text into the shell as a paste (bracketed paste when enabled). */
  paste(text: string): void {
    this.view.paste(text);
    this.focus();
  }

  /** The shell ended with `code`; null = it never started. */
  markExited(code: number | null): void {
    if (code !== null) log.info(`pty ${this.id} exited with code ${code}`);
    this.link.markClosed();
    this.el.classList.add("exited");
    this.header.showExit(code);
  }

  enter(): void {
    animateEnter(this.el);
  }

  leave(): Promise<void> {
    return animateLeave(this.el);
  }

  dispose(): void {
    this.link.kill();
    this.glow.dispose();
    this.herons.dispose();
    this.header.dispose();
    this.view.dispose();
    this.el.remove();
  }
}
