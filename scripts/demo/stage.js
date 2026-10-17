// What the scenes do to the app, found by what is on the page (titles,
// classes) rather than by screen coordinates: open and close panes, pick a
// shell, fold the sidebar, switch the language, type into a pane.

import { setTimeout as sleep } from "node:timers/promises";

const NEW = ".titlebar .tb-primary:not(.tb-arrow)";
const MENU = ".titlebar .tb-arrow";
const GEAR = ".titlebar .tb-settings";
const PANE = ".pane:not(.leaving)";

export function createStage(cdp, ui) {
  const count = () => cdp.js(`document.querySelectorAll(${JSON.stringify(PANE)}).length`);
  const waitCount = (n) => cdp.waitFor(`document.querySelectorAll(${JSON.stringify(PANE)}).length === ${n}`);

  /** Where an element with exactly this text (after a leading mark like ✓) is. */
  async function atText(selector, text) {
    const i = await cdp.js(
      `[...document.querySelectorAll(${JSON.stringify(selector)})]` +
        `.findIndex((e) => e.textContent.replace(/^[^\\w가-힣]+/, "").trim() === ${JSON.stringify(text)})`,
    );
    if (i < 0) throw new Error(`no ${selector} says ${text}`);
    return ui.at(selector, i);
  }

  /** Picks the shell the + button opens. */
  async function pick(shell) {
    await ui.click(await ui.at(MENU));
    await cdp.waitFor(`!!document.querySelector(".shell-menu-item")`, 3000);
    await sleep(350);
    await ui.click(await atText(".shell-menu-item", shell));
    await sleep(300);
  }

  /** + opens a pane with the picked shell; resolves once it is there. */
  async function newPane() {
    const n = await count();
    await ui.click(await ui.at(NEW));
    await waitCount(n + 1);
  }

  async function closeAll() {
    for (let n = await count(); n > 0; n--) {
      await ui.click(await ui.at(`${PANE} .pane-close`, n - 1));
      await waitCount(n - 1);
      await sleep(500); // the others glide into place before the next close is found
    }
  }

  /** Back to these shells, one pane each, with PowerShell picked for +. */
  async function reset(shells = ["PowerShell"]) {
    await closeAll();
    for (const shell of shells) {
      await pick(shell);
      await newPane();
    }
    await pick("PowerShell");
    await sleep(800);
  }

  async function settings(change) {
    await ui.click(await ui.at(GEAR));
    await cdp.waitFor(`!!document.querySelector(".settings-panel .theme-black")`, 3000);
    await sleep(300);
    await change();
    await ui.click(await ui.at(GEAR));
    await sleep(300);
  }

  /** English or Korean, through the settings like a user would. */
  async function setLang(lang) {
    if ((await cdp.js("document.documentElement.lang")) === lang) return;
    await settings(async () => ui.click(await atText(".lang-toggle .tb-button", lang === "ko" ? "한국어" : "English")));
  }

  async function setSidebar(open) {
    const collapsed = await cdp.js(`document.querySelector(".agent-sidebar").classList.contains("collapsed")`);
    if (collapsed === open) await ui.click(await ui.at(".sidebar-toggle"));
    await sleep(400);
  }

  const paneBody = (i) => ui.at(`${PANE} .pane-body`, i);

  /** Clicks into pane i, types the line and presses Enter. */
  async function typeLine(i, text, delayMs = 45) {
    await ui.click(await paneBody(i));
    await sleep(250);
    await ui.type(text, delayMs);
    await ui.enter();
  }

  const park = async () => ui.move(await ui.at("#workspace", 0, 0.5, 0.55), 220);

  return {
    cdp,
    count, atText, pick, newPane, reset, setLang, setSidebar, paneBody, typeLine, park,
    gear: () => ui.at(GEAR),
    newButton: () => ui.at(NEW),
  };
}
