import { SHELL_LABELS } from "../app/shells";
import type { UptimeClock } from "../app/uptime-clock";
import type { ShellKind } from "../ipc/pty";
import { TerminalView } from "../terminal/terminal-view";
import { OutputGlow } from "./output-glow";
import { createPaneFrame } from "./pane-frame";
import type { PaneHeader } from "./pane-header";
import { PaneHerons } from "./pane-herons";
import { watchPaneTerminal, type PaneSignal } from "./pane-signals";
import { PtyLink } from "./pty-link";
import { typeAtFirstPrompt } from "./start-command";

// The parts of one pane (pane.ts), built and wired together: the frame
// (header and terminal box, pane-frame.ts), the xterm view, the PTY link,
// which lights the glow on output, the terminal herons over the view
// (pane-herons.ts), and the terminal's title, folder and signals
// (pane-signals.ts), through which the start command is typed at the first
// prompt (start-command.ts).

export interface PaneParts {
  el: HTMLElement;
  header: PaneHeader;
  view: TerminalView;
  link: PtyLink;
  glow: OutputGlow;
  herons: PaneHerons;
  /** The folder the shell last reported. */
  where: () => string | null;
}

/** What the parts are made with. */
export interface PartsOptions {
  shell: ShellKind;
  fontSize: number;
  clock: UptimeClock;
  /** Typed into the shell at its first prompt. */
  run?: string;
}

/** What the parts call back in the pane. */
export interface PartsCallbacks {
  /** "pty 3", for log lines. */
  name: () => string;
  close: () => void;
  focus: () => void;
  signal: (signal: PaneSignal) => void;
}

export function createPaneParts(parent: HTMLElement, opts: PartsOptions, on: PartsCallbacks): PaneParts {
  const frame = createPaneFrame(parent, SHELL_LABELS[opts.shell], opts.clock, on.close, on.focus);
  const view = new TerminalView(frame.host, opts.fontSize);
  const glow = new OutputGlow(frame.el);
  const herons = new PaneHerons(view.term, opts.clock);
  const link = new PtyLink(view, () => glow.ping());
  const type = (text: string) => view.term.input(text, true);
  const emit = typeAtFirstPrompt(opts.run, type, on.signal);
  const where = watchPaneTerminal(view.term, on.name, frame.header, emit);
  return { el: frame.el, header: frame.header, view, link, glow, herons, where };
}
