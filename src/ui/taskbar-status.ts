import type { AgentState } from "../agent/agent-model";
import { taskbarOf, type TaskbarState } from "../agent/taskbar-state";
import { createLogger } from "../app/log";
import { setTaskbarOverlay, setTaskbarProgress } from "../ipc/attention";

// The agents on Heron's taskbar button (agent/taskbar-state.ts): a moving
// bar while any works, a full yellow bar while one needs you, and the number
// working in a dot of the working color over the icon. Windows draws them,
// so nothing animates in the page. Each is sent only when it changes, one
// call after another so a late answer never undoes a newer one.

const log = createLogger("taskbar");
/** Overlay icons are small icons: 16 px at 100% scale. */
const ICON_PX = 16;
const PROGRESS = { none: "none", working: "moving", needs: "paused" } as const;

/** The number in a round badge, as RGBA pixels at the screen's scale; null without a canvas. */
function drawBadge(count: number): { rgba: Uint8Array; size: number } | null {
  const size = Math.round(ICON_PX * window.devicePixelRatio);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return null;
  // The colors of the sidebar's working badge (agent-item.css).
  const css = getComputedStyle(document.documentElement);
  g.fillStyle = css.getPropertyValue("--agent-work").trim();
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  g.fill();
  const text = count > 9 ? "9+" : String(count);
  g.fillStyle = css.getPropertyValue("--bg-app").trim();
  g.font = `700 ${Math.round(size * (text.length > 1 ? 0.55 : 0.75))}px "Segoe UI", sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, size / 2, size * 0.54);
  return { rgba: new Uint8Array(g.getImageData(0, 0, size, size).data.buffer), size };
}

export interface TaskbarStatus {
  /** The states of the agents in the panes. */
  render(states: AgentState[]): void;
}

export function createTaskbarStatus(): TaskbarStatus {
  // Unknown at first: a reloaded page finds what the last one left.
  let last: TaskbarState | null = null;
  let queue = Promise.resolve();
  const send = (what: string, call: () => Promise<void>) => {
    queue = queue.then(call).catch((err) => log.warn(`taskbar ${what} failed`, err));
  };

  return {
    render(states) {
      const next = taskbarOf(states);
      if (next.bar === last?.bar && next.working === last.working) return;
      log.debug(`bar ${next.bar}, ${next.working} working`);
      if (next.bar !== last?.bar) send("bar", () => setTaskbarProgress(PROGRESS[next.bar]));
      if (next.working !== last?.working) send("badge", () => setTaskbarOverlay(next.working > 0 ? drawBadge(next.working) : null));
      last = next;
    },
  };
}
