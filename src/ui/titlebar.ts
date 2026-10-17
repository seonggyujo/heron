import { getCurrentWindow } from "@tauri-apps/api/window";
import { onLangChange, t } from "../i18n/lang";
import { showWindowMenu } from "../ipc/window-menu";

// macOS-style unified title bar: brand on the left, app actions and then
// the traffic lights on the right. The empty space drags the window, and a
// double-click there toggles maximize (handled by data-tauri-drag-region);
// a right-click there opens the window's system menu, as in any window.

const GLYPHS = {
  close: '<path d="M3 3l4 4M7 3l-4 4"/>',
  minimize: '<path d="M2.5 5h5"/>',
  zoom: '<path class="fill" d="M2.6 2.6h3.6L2.6 6.2zM7.4 7.4H3.8l3.6-3.6z"/>',
} as const;

type LightKind = keyof typeof GLYPHS;

function label(kind: LightKind): string {
  return kind === "close" ? t().close : kind === "minimize" ? t().minimize : t().maximize;
}

function light(kind: LightKind): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = `light ${kind}`;
  btn.type = "button";
  btn.innerHTML = `<svg viewBox="0 0 10 10" aria-hidden="true">${GLYPHS[kind]}</svg>`;
  return btn;
}

export interface Titlebar {
  el: HTMLElement;
  /** Right-hand slot for app actions (counter, new-terminal button). */
  actions: HTMLElement;
}

export function createTitlebar(): Titlebar {
  const win = getCurrentWindow();

  const el = document.createElement("header");
  el.className = "titlebar";
  el.setAttribute("data-tauri-drag-region", "");

  const lights = document.createElement("div");
  lights.className = "traffic-lights";
  const close = light("close");
  const minimize = light("minimize");
  const zoom = light("zoom");
  close.addEventListener("click", () => void win.close());
  minimize.addEventListener("click", () => void win.minimize());
  zoom.addEventListener("click", () => void win.toggleMaximize());
  // Windows order: close sits at the far right edge.
  lights.append(minimize, zoom, close);
  const labelLights = () =>
    ([["close", close], ["minimize", minimize], ["zoom", zoom]] as const).forEach(([kind, btn]) =>
      btn.setAttribute("aria-label", label(kind)),
    );
  labelLights();
  onLangChange(labelLights);

  const brand = document.createElement("div");
  brand.className = "brand";
  brand.innerHTML = '<span class="brand-dot">●</span> HERON';

  const actions = document.createElement("div");
  actions.className = "titlebar-actions";

  el.append(brand, actions, lights);
  el.addEventListener("contextmenu", (e) => {
    if ((e.target as Element).closest("button")) return;
    e.preventDefault();
    void showWindowMenu(true);
  });

  // Grey out the traffic lights when the window loses focus, like macOS.
  // The Tauri window event follows the OS window's activation.
  const root = document.documentElement;
  void win.onFocusChanged(({ payload: focused }) => root.classList.toggle("window-inactive", !focused));

  return { el, actions };
}
