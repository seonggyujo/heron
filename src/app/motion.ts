import { motionPref } from "./prefs";

// Settings > Animations. Off: no pane enter/leave or FLIP animations
// (visibility.ts motionAllowed), no output glow (pane/output-glow.ts), and
// <html class="no-motion"> stops every CSS transition and keyframe
// animation (styles/effects.css).

/** The app's ease-out curve for pane moves (Heron's EASE_OUT). */
export const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export function motionEnabled(): boolean {
  return motionPref.get();
}

export function applyMotion(): void {
  document.documentElement.classList.toggle("no-motion", !motionPref.get());
}

export function setMotion(on: boolean): void {
  motionPref.set(on);
  applyMotion();
}
