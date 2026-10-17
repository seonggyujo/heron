import { invoke } from "@tauri-apps/api/core";

// Sends one frontend log line to the backend, which prints it in the
// `tauri dev` terminal (commands/mod.rs `frontend_log`). Dev only.

export type LogLevel = "error" | "warn" | "info" | "debug";

export const forwardLog = (level: LogLevel, scope: string, message: string) =>
  invoke<void>("frontend_log", { level, scope, message });
