import type { Terminal } from "@xterm/xterm";
import { doingOf } from "../agent/activity";
import type { Agent } from "../agent/agent-model";
import { heronsPref } from "../app/prefs";
import type { UptimeClock } from "../app/uptime-clock";
import { isAppHidden, motionAllowed } from "../app/visibility";
import { Flock, type FlockAgent } from "../buddy/flock";
import { STAGE_H } from "../buddy/sprites";
import { paintPose } from "./heron-paint";
import { HeronScreen } from "./heron-screen";

// The terminal herons of one pane on a canvas over its terminal: while the
// pane has a coding agent, as many herons as Settings > Terminal herons
// asks (buddy/flock.ts), on blank cells only. The terminal's content is
// never touched. Frames run only while something moves. The 1-second clock
// wakes still herons (and notices a changed setting), and every terminal
// render does too, since text may have covered a heron. None with
// Settings > Animations off; paused while the window is hidden.

/** A heron with its mark over its head is this many rows tall. */
const STAGE_ROWS = 3;

const flockAgentOf = (a: Agent): FlockAgent => ({
  state: a.state,
  doing: doingOf(a.activity?.step ?? null),
  subagents: a.subagents.length,
});

export class PaneHerons {
  private readonly canvas = document.createElement("canvas");
  private readonly screen: HeronScreen;
  private readonly flock = new Flock();
  private agent: FlockAgent | null = null;
  private drawn = false;
  private frame = 0;
  private timer = 0;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly term: Terminal,
    clock: UptimeClock,
  ) {
    this.canvas.className = "pane-herons";
    this.canvas.setAttribute("aria-hidden", "true");
    term.element?.querySelector(".xterm-screen")?.append(this.canvas);
    this.screen = new HeronScreen(term);
    const rendered = term.onRender(this.wake);
    const untick = clock.subscribe(this.wake);
    this.unsubscribe = () => {
      rendered.dispose();
      untick();
    };
  }

  /** The pane's agent now, null for none. */
  show(agent: Agent | null): void {
    this.agent = agent && flockAgentOf(agent);
    this.wake();
  }

  dispose(): void {
    this.unsubscribe();
    cancelAnimationFrame(this.frame);
    clearTimeout(this.timer);
    this.canvas.remove();
  }

  private readonly wake = (): void => {
    if (!this.frame) this.frame = requestAnimationFrame(() => this.step());
  };

  private step(): void {
    this.frame = 0;
    clearTimeout(this.timer);
    if (isAppHidden()) return; // the clock wakes it on return
    const want = motionAllowed() ? heronsPref.get() : 0;
    const host = this.canvas.parentElement;
    if (!want || !host || (!this.agent && this.flock.empty)) {
      this.flock.clear();
      this.clear();
      return;
    }
    // One sprite pixel in CSS px, from the cell size xterm laid out.
    const cellW = host.clientWidth / this.term.cols;
    const cellH = host.clientHeight / this.term.rows;
    const px = (STAGE_ROWS * cellH) / STAGE_H;
    if (!(px > 0)) return;
    const now = Math.floor(performance.now());
    this.screen.refresh();
    this.flock.step(this.agent, want, this.screen, { w: cellW / px, h: cellH / px }, now);
    this.paint(host, px, now);
    const wait = this.flock.wait(now);
    if (wait) this.timer = window.setTimeout(this.wake, wait);
  }

  private paint(host: HTMLElement, px: number, now: number): void {
    const scale = window.devicePixelRatio || 1;
    const w = Math.round(host.clientWidth * scale);
    const h = Math.round(host.clientHeight * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.canvas.style.width = `${host.clientWidth}px`;
      this.canvas.style.height = `${host.clientHeight}px`;
    }
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    paintPose(ctx, this.flock.pose(now), px * scale);
    this.drawn = !this.flock.empty;
  }

  private clear(): void {
    if (!this.drawn) return;
    this.canvas.getContext("2d")?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawn = false;
  }
}
