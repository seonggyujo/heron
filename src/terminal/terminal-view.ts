import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { createLogger } from "../app/log";
import { attachPaste, attachRightClick, pasteInto } from "./clipboard";
import { attachClipboardKeys } from "./keys";
import { attachLinks } from "./links";
import { attachShiftWheel } from "./wheel";

// One xterm instance with fit + WebGL. The terminal itself is not styled:
// default xterm colors, only the Windows console font. No IPC here: the pane
// wires this to a PTY. Falls back to the DOM renderer when WebGL is
// unavailable or lost. On dispose the WebGL context is let go at once: the
// addon does not, and a page keeps only so many contexts alive.

const log = createLogger("terminal");

const FONT = '"Cascadia Mono", Consolas, monospace';
/** Double-click selects a word up to these (heron-c's set: brackets, quotes, pipes, separators). */
const WORD_SEPARATORS = " ()[]{}<>'\"`,;|";

interface Size {
  cols: number;
  rows: number;
}

export class TerminalView {
  readonly term: Terminal;
  private readonly fitAddon = new FitAddon();
  /** The canvas the WebGL renderer draws on, while it does. */
  private glCanvas: HTMLCanvasElement | null = null;
  private size: Size = { cols: 0, rows: 0 };

  constructor(host: HTMLElement, fontSize: number) {
    this.term = new Terminal({
      fontFamily: FONT,
      fontSize,
      // Bounded history keeps memory flat under heavy output.
      scrollback: 5000,
      // Lets xterm reflow the way ConPTY expects on resize.
      windowsPty: { backend: "conpty" },
      wordSeparator: WORD_SEPARATORS,
    });
    this.term.loadAddon(this.fitAddon);
    this.term.open(host);
    this.loadWebgl();
    attachClipboardKeys(this.term);
    attachRightClick(this.term, host);
    attachPaste(this.term, host);
    attachShiftWheel(this.term);
    attachLinks(this.term, host);
  }

  private loadWebgl(): void {
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        log.warn("WebGL context lost, falling back to DOM renderer");
        this.glCanvas = null;
        webgl.dispose();
      });
      this.term.loadAddon(webgl);
      this.glCanvas = this.term.element?.querySelector<HTMLCanvasElement>(".xterm-screen canvas") ?? null;
      log.debug("WebGL renderer active");
    } catch (err) {
      log.warn("WebGL unavailable, using DOM renderer", err);
    }
  }

  /** Fits to the host. Returns the new size only if cols/rows changed. */
  fit(): Size | null {
    const dims = this.fitAddon.proposeDimensions();
    if (!dims || !Number.isFinite(dims.cols) || !Number.isFinite(dims.rows)) return null;
    const cols = Math.max(2, dims.cols);
    const rows = Math.max(1, dims.rows);
    if (cols === this.size.cols && rows === this.size.rows) return null;
    this.size = { cols, rows };
    this.term.resize(cols, rows);
    return this.size;
  }

  /** Caller must fit() afterwards: cell size changed, host size did not. */
  setFontSize(px: number): void {
    this.term.options.fontSize = px;
  }

  /** Types text in as a paste (dropped file paths). */
  paste(text: string): void {
    pasteInto(this.term, text);
  }

  write(data: Uint8Array, done?: () => void): void {
    this.term.write(data, done);
  }

  focus(): void {
    this.term.focus();
  }

  dispose(): void {
    const gl = this.glCanvas?.getContext("webgl2");
    this.term.dispose();
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
