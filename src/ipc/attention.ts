import { invoke } from "@tauri-apps/api/core";
import { Image } from "@tauri-apps/api/image";
import { getCurrentWindow, ProgressBarStatus } from "@tauri-apps/api/window";

// Heron's taskbar button. It flashes while another app is in front, so an
// agent is noticed from there (see attention.rs); nothing happens while
// Heron is in front. Its progress bar and the picture over its icon stay
// until changed (Tauri's window API, ITaskbarList3 underneath).

export const flashTaskbar = () => invoke<void>("flash_taskbar");

/** "moving": a bar that runs without end; "paused": a full yellow bar. */
export type TaskbarProgress = "none" | "moving" | "paused";

const STATUS = {
  none: ProgressBarStatus.None,
  moving: ProgressBarStatus.Indeterminate,
  paused: ProgressBarStatus.Paused,
};

export function setTaskbarProgress(progress: TaskbarProgress): Promise<void> {
  // A paused bar is drawn as far as its value goes.
  return getCurrentWindow().setProgressBar({ status: STATUS[progress], progress: progress === "paused" ? 100 : undefined });
}

/** A square RGBA picture over the taskbar icon; null takes it away. */
export async function setTaskbarOverlay(icon: { rgba: Uint8Array; size: number } | null): Promise<void> {
  if (!icon) return getCurrentWindow().setOverlayIcon(undefined);
  const image = await Image.new(icon.rgba, icon.size, icon.size);
  try {
    await getCurrentWindow().setOverlayIcon(image);
  } finally {
    await image.close();
  }
}
