import { agentHooksOn, setAgentHooks } from "../app/agent-hooks";
import { hooksOfferHiddenPref, pluginHintHiddenPref, type Pref } from "../app/prefs";
import { hooksErrorText } from "../i18n/hooks-error";
import { t } from "../i18n/lang";

// The notes at the bottom of the agent sidebar. First an offer to turn on
// Heron's Claude Code hooks (permission requests, questions, model checks);
// once they are on, or the offer is closed, a pointer to the heron-limits
// plugin for usage limits and context use. Each can be closed for good.

export interface AgentHints {
  el: HTMLElement;
  /** `pluginSeen`: data of the plugin's status line has arrived. */
  render(pluginSeen: boolean): void;
}

function closable(pref: Pref<boolean>, redraw: () => void): { el: HTMLElement; text: HTMLElement } {
  const el = document.createElement("div");
  el.className = "agent-hint";
  el.innerHTML = '<span class="hint-text"></span><button type="button" class="hint-close">×</button>';
  el.querySelector(".hint-close")!.addEventListener("click", () => {
    pref.set(true);
    redraw();
  });
  return { el, text: el.querySelector<HTMLElement>(".hint-text")! };
}

export function createAgentHints(): AgentHints {
  const el = document.createElement("div");
  el.className = "agent-hints";
  let pluginSeen = false;
  const redraw = () => render(pluginSeen);

  const offer = closable(hooksOfferHiddenPref, redraw);
  const action = document.createElement("div");
  action.className = "hint-action";
  action.innerHTML = '<button type="button"></button><span class="hint-error"></span>';
  const turnOn = action.querySelector("button")!;
  const error = action.querySelector<HTMLElement>(".hint-error")!;
  offer.el.classList.add("hooks-offer");
  offer.el.append(action);
  const plugin = closable(pluginHintHiddenPref, redraw);
  el.append(offer.el, plugin.el);

  turnOn.addEventListener("click", async () => {
    turnOn.disabled = true;
    turnOn.textContent = t().hooksTurningOn;
    error.textContent = "";
    const code = await setAgentHooks(true);
    turnOn.disabled = false;
    turnOn.textContent = t().hooksTurnOn;
    // On success the hooks listener redraws the sidebar and the offer goes.
    if (code) error.textContent = hooksErrorText(code);
  });

  function render(seen: boolean): void {
    pluginSeen = seen;
    const s = t();
    offer.el.hidden = agentHooksOn() || hooksOfferHiddenPref.get();
    offer.text.textContent = s.hooksOffer;
    if (!turnOn.disabled) turnOn.textContent = s.hooksTurnOn;
    plugin.el.hidden = !offer.el.hidden || seen || pluginHintHiddenPref.get();
    plugin.text.textContent = s.agentPluginHint;
    for (const close of el.querySelectorAll<HTMLElement>(".hint-close")) {
      close.setAttribute("aria-label", s.hide);
      close.title = s.hide;
    }
  }

  return { el, render };
}
