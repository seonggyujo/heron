import { EASE_OUT } from "../app/motion";
import { motionAllowed } from "../app/visibility";

// Pane enter/leave animations. Transform and opacity only.

/** Scale + fade in. */
export function animateEnter(el: HTMLElement): void {
  if (!motionAllowed()) return;
  el.animate(
    [
      { opacity: 0, transform: "scale(0.96)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 220, easing: EASE_OUT },
  );
}

/** Shrink + fade out; resolves when the element may be removed. */
export async function animateLeave(el: HTMLElement): Promise<void> {
  el.classList.add("leaving");
  if (!motionAllowed()) return;
  const anim = el.animate(
    [
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: "scale(0.94)" },
    ],
    { duration: 180, easing: "ease-in", fill: "forwards" },
  );
  await anim.finished.catch(() => {});
}
