import { urgency } from "../agent/agent-model";
import { onAgentHooksChange } from "../app/agent-hooks";
import { sidebarCollapsedPref } from "../app/prefs";
import type { UptimeClock } from "../app/uptime-clock";
import { onLangChange, t } from "../i18n/lang";
import { createAgentHints } from "./agent-hints";
import { createAgentItem, type AgentItem, type AgentRow } from "./agent-item";

// Left sidebar for coding agents, always shown: the "New agent" button, the
// panes that run an agent, most urgent first (needs you, finished, working,
// idle), the recent sessions, and the notes of agent-hints.ts at the bottom.
// The button comes from wire-new-agent.ts, the sessions from
// wire-sessions.ts. It collapses to a narrow rail of numbered badges; the
// choice is remembered. Rows are rebuilt when an agent changes; the
// 1-second tick only updates working and subagent times.

export interface AgentSidebar {
  el: HTMLElement;
  /** `pluginSeen`: data of the heron-limits plugin has arrived. */
  render(rows: AgentRow[], pluginSeen: boolean): void;
}

export interface SidebarActions {
  onPick(pty: number): void;
  /** The pointer is over a row (or left it: null). */
  onHover(pty: number | null): void;
}

/** Parts of the sidebar made elsewhere: the "New agent" button and the recent sessions. */
export interface SidebarParts {
  start: HTMLElement;
  sessions: HTMLElement;
}

export function createAgentSidebar(clock: UptimeClock, actions: SidebarActions, parts: SidebarParts): AgentSidebar {
  const el = document.createElement("aside");
  el.className = "agent-sidebar";
  el.classList.toggle("collapsed", sidebarCollapsedPref.get());
  el.innerHTML =
    '<div class="sidebar-head"><span class="sidebar-title"></span><button type="button" class="sidebar-toggle"></button></div>' +
    '<div class="sidebar-start"></div><div class="sidebar-list"></div><div class="sidebar-empty"></div>' +
    '<div class="sidebar-foot"></div>';
  const title = el.querySelector<HTMLElement>(".sidebar-title")!;
  const toggle = el.querySelector<HTMLButtonElement>(".sidebar-toggle")!;
  const list = el.querySelector<HTMLElement>(".sidebar-list")!;
  const empty = el.querySelector<HTMLElement>(".sidebar-empty")!;
  const foot = el.querySelector<HTMLElement>(".sidebar-foot")!;
  el.querySelector(".sidebar-start")!.append(parts.start);
  empty.after(parts.sessions);
  const hints = createAgentHints();
  foot.append(hints.el);

  let rows: AgentRow[] = [];
  let pluginSeen = false;
  let items: AgentItem[] = [];

  const tick = (now: number) => items.forEach((item) => item.tick(now));
  const ticking = clock.switchFor(tick);

  const draw = () => {
    const sorted = [...rows].sort((a, b) => urgency(a.agent.state) - urgency(b.agent.state) || a.number - b.number);
    // Replaced rows never get mouseleave: drop any pane highlight first.
    if (items.length > 0) actions.onHover(null);
    items = sorted.map((row) => createAgentItem(row, actions.onPick, actions.onHover));
    list.replaceChildren(...items.map((item) => item.el));
    empty.hidden = sorted.length > 0;
    empty.textContent = t().noAgents;
    const collapsed = sidebarCollapsedPref.get();
    el.classList.toggle("collapsed", collapsed);
    title.textContent = t().agents;
    toggle.textContent = collapsed ? "›" : "‹";
    toggle.title = collapsed ? t().expand : t().collapse;
    toggle.setAttribute("aria-label", toggle.title);
    hints.render(pluginSeen);
    tick(Date.now());
    // The clock ticks only while a row shows a working time.
    ticking(sorted.length > 0);
  };

  toggle.addEventListener("click", () => {
    sidebarCollapsedPref.set(!sidebarCollapsedPref.get());
    draw();
  });
  onLangChange(draw);
  onAgentHooksChange(draw);
  draw();

  return {
    el,
    render(nextRows, nextPluginSeen) {
      rows = nextRows;
      pluginSeen = nextPluginSeen;
      draw();
    },
  };
}
