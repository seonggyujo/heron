import { getCurrentWebview } from "@tauri-apps/api/webview";
import { createLogger } from "../app/log";
import type { PaneItem as Pane } from "./pane-item";

// Dropping files on a pane types their paths into it, like Windows
// Terminal: quoted when needed, separated by spaces. Tools such as CLI
// agents then pick the files up (e.g. an image to attach).
// Tauri takes over native file drops, so HTML drop events never fire; the
// webview drag-drop event is used instead. Its position is in physical
// pixels.

const log = createLogger("file-drop");

function quote(path: string): string {
  return /[\s&()[\]{}^=;!'+,`~]/.test(path) ? `"${path}"` : path;
}

export async function installFileDrop(paneAt: (x: number, y: number) => Pane | undefined): Promise<void> {
  let target: Pane | undefined;
  const mark = (pane: Pane | undefined) => {
    if (pane === target) return;
    target?.el.classList.remove("drop-target");
    pane?.el.classList.add("drop-target");
    target = pane;
  };

  await getCurrentWebview().onDragDropEvent(({ payload }) => {
    if (payload.type === "leave") return mark(undefined);
    const dpr = window.devicePixelRatio || 1;
    const pane = paneAt(payload.position.x / dpr, payload.position.y / dpr);
    if (payload.type !== "drop") return mark(pane);

    mark(undefined);
    if (!pane || payload.paths.length === 0) return;
    pane.paste(payload.paths.map(quote).join(" ") + " ");
    log.info(`dropped ${payload.paths.length} path(s) on ${pane.name}`);
  });
}
