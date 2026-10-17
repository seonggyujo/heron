import { isAppHidden, onAppVisibility } from "./visibility";

// The only periodic timer in the app: one 1-second interval shared by all
// panes. It stops while the app is hidden or minimized and catches up on
// return.

type Tick = (now: number) => void;

export class UptimeClock {
  private readonly listeners = new Set<Tick>();
  private timer = 0;

  constructor() {
    onAppVisibility(() => this.sync());
  }

  /** Calls `fn` now and then every second. Returns an unsubscribe. */
  subscribe(fn: Tick): () => void {
    this.listeners.add(fn);
    fn(Date.now());
    this.sync();
    return () => {
      this.listeners.delete(fn);
      this.sync();
    };
  }

  /** A switch for `fn`, for what ticks only at times: on subscribes it (once), off unsubscribes. */
  switchFor(fn: Tick): (on: boolean) => void {
    let stop: (() => void) | null = null;
    return (on) => {
      if (on && !stop) stop = this.subscribe(fn);
      else if (!on && stop) {
        stop();
        stop = null;
      }
    };
  }

  private sync(): void {
    const shouldRun = this.listeners.size > 0 && !isAppHidden();
    if (shouldRun && !this.timer) {
      this.tick();
      this.timer = window.setInterval(() => this.tick(), 1000);
    } else if (!shouldRun && this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  private tick(): void {
    const now = Date.now();
    this.listeners.forEach((fn) => fn(now));
  }
}
