import { EASE_OUT } from "../app/motion";
import { motionAllowed } from "../app/visibility";

// FLIP: measure, change layout, then animate each element from its old box
// to its new one. Only `transform` is animated, so it stays on the
// compositor; the real layout (and PTY resize) happens at once.

const DURATION = 220;

export function flip(elements: HTMLElement[], mutate: () => void): void {
  if (!motionAllowed() || elements.length === 0) {
    mutate();
    return;
  }

  const before = elements.map((el) => el.getBoundingClientRect());
  mutate();

  elements.forEach((el, i) => {
    if (!el.isConnected) return;
    const a = before[i];
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return;

    const dx = a.left - b.left;
    const dy = a.top - b.top;
    const sx = a.width / b.width;
    const sy = a.height / b.height;
    const moved = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
    const scaled = Math.abs(sx - 1) > 0.005 || Math.abs(sy - 1) > 0.005;
    if (!moved && !scaled) return;

    el.animate(
      [
        { transformOrigin: "top left", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transformOrigin: "top left", transform: "none" },
      ],
      { duration: DURATION, easing: EASE_OUT },
    );
  });
}
