import { formatTokens, totalOf, type TokenReport, type Usage } from "../agent/tokens";
import { span } from "../app/dom";
import { t } from "../i18n/lang";

// The tokens line of a sidebar row (agent/tokens.ts):
//   1.24M tokens · 38.2k this turn
// The tooltip splits them by kind, for the session and the turn.

/** Null before the agent used any. */
export function createTokenLine(report: TokenReport): HTMLSpanElement | null {
  const total = totalOf(report.session);
  if (total === 0) return null;
  return span("agent-tokens", t().tokens(formatTokens(total), formatTokens(totalOf(report.turn))));
}

function kinds(u: Usage): string {
  return t().tokenKinds(formatTokens(u.input), formatTokens(u.output), formatTokens(u.cacheWrite), formatTokens(u.cacheRead));
}

/** Tooltip lines: the session's and the turn's tokens by kind. */
export function tokenTips(report: TokenReport): string[] {
  if (totalOf(report.session) === 0) return [];
  const s = t();
  const session = report.complete ? s.tokensSession : s.tokensSessionCounting;
  return [`${session}: ${kinds(report.session)}`, `${s.tokensTurn}: ${kinds(report.turn)}`];
}
