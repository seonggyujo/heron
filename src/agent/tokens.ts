import { fieldsOf, numberOf } from "../app/unchecked";

// The tokens a pane's agent used, from the backend's count over its
// transcript (src-tauri/src/agent/tokens.rs): the whole session and the
// current turn, by kind. Pure.

/** Tokens by kind: fresh input, output, input written to and read from the prompt cache. */
export interface Usage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface TokenReport {
  session: Usage;
  turn: Usage;
  /** The part of the session written before Heron followed it is counted too. */
  complete: boolean;
}

function usageOf(v: unknown): Usage {
  const u = fieldsOf(v);
  const n = (key: string) => numberOf(u[key]) ?? 0;
  return { input: n("input"), output: n("output"), cacheWrite: n("cacheWrite"), cacheRead: n("cacheRead") };
}

/** The backend's report, checked. */
export function tokensOf(data: unknown): TokenReport {
  const d = fieldsOf(data);
  return { session: usageOf(d.session), turn: usageOf(d.turn), complete: d.complete === true };
}

/** Every token of every kind. */
export function totalOf(u: Usage): number {
  return u.input + u.output + u.cacheWrite + u.cacheRead;
}

/** 950, 1.2k, 12.3k, 123k, 1.24M, 12.4M, 124M */
export function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) return `${(n / 1e3).toFixed(n < 1e5 ? 1 : 0)}k`;
  if (n < 1e9) return `${(n / 1e6).toFixed(n < 1e7 ? 2 : n < 1e8 ? 1 : 0)}M`;
  return `${(n / 1e9).toFixed(2)}B`;
}
