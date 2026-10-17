import { forwardLog, type LogLevel } from "../ipc/log";

// Scoped logger. In dev every line goes to the DevTools console and is also
// forwarded to the `tauri dev` terminal. In production only warn and error
// reach the console, and nothing is sent over IPC.
// Never log per output chunk: that is the hot path.

export interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

const DEV = import.meta.env.DEV;

function format(args: unknown[]): string {
  return args
    .map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
}

function emit(level: LogLevel, scope: string, args: unknown[]): void {
  if (!DEV && (level === "info" || level === "debug")) return;
  console[level](`%c[${scope}]`, "color:#5fae7f", ...args);
  if (DEV) {
    forwardLog(level, scope, format(args)).catch(() => {});
  }
}

export function createLogger(scope: string): Logger {
  return {
    error: (...a) => emit("error", scope, a),
    warn: (...a) => emit("warn", scope, a),
    info: (...a) => emit("info", scope, a),
    debug: (...a) => emit("debug", scope, a),
  };
}
