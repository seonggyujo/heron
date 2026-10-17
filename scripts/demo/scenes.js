// The README GIFs about the terminal itself, filmed with the sidebar folded
// and the UI in English. prepare() brings the app to the scene's start (not
// filmed), run() is what the GIF shows. Each prepare checks what the scene
// before left, so any scene can be recorded on its own.

import { setTimeout as sleep } from "node:timers/promises";

const shellsOf = (cdp) => cdp.js(`[...document.querySelectorAll(".pane:not(.leaving) .pane-shell")].map((e) => e.textContent).join(",")`);

async function terminalStart(stage, shells) {
  await stage.setLang("en");
  await stage.setSidebar(false);
  if ((await shellsOf(stage.cdp)) !== shells.join(",")) await stage.reset(shells);
}

export const SCENES = {
  // 1 pane, + five times, then three closed: the grid rearranges itself.
  split: {
    prepare: (stage) => terminalStart(stage, ["PowerShell"]),
    async run(stage, ui) {
      for (let i = 0; i < 5; i++) {
        await ui.click(await stage.newButton());
        await sleep(700);
      }
      await sleep(600);
      for (const n of [6, 5, 4]) {
        await ui.click(await ui.at(".pane:not(.leaving) .pane-close", n - 2));
        await sleep(750);
      }
    },
  },

  // Resize by the gaps, equal again by double-click, swap two panes.
  arrange: {
    prepare: (stage) => terminalStart(stage, ["PowerShell", "PowerShell", "PowerShell"]),
    async run(stage, ui) {
      const across = ".divider.row:not([hidden])";
      const down = ".divider.column:not([hidden])";
      const [vx, vy] = await ui.at(across);
      await ui.drag([vx, vy], [vx + 220, vy]);
      await sleep(700);
      const [hx, hy] = await ui.at(down);
      await ui.drag([hx, hy], [hx, hy + 110]);
      await sleep(900);
      await ui.doubleClick(await ui.at(across));
      await sleep(800);
      await ui.doubleClick(await ui.at(down));
      await sleep(900);
      // The wide bottom pane onto the middle of the top-left one.
      await ui.drag(await ui.at(".pane:not(.leaving) .pane-shell", 2), await stage.paneBody(0), 1100);
      await stage.park();
      await sleep(1200);
    },
  },

  // The shell menu, and pane headers that follow the folder.
  shells: {
    prepare: (stage) => terminalStart(stage, ["PowerShell"]),
    async run(stage, ui) {
      await stage.pick("cmd");
      await stage.newPane();
      await sleep(900);
      await ui.type("cd C:\\Windows", 60);
      await ui.enter();
      await sleep(900);
      await stage.pick("Git Bash");
      await stage.newPane();
      await sleep(1400);
      await ui.type("cd /c/Users", 60);
      await ui.enter();
      await sleep(900);
    },
  },

  // Output lights a pane up; exit 0 closes it, a failing exit keeps it.
  activity: {
    prepare: (stage) => terminalStart(stage, ["PowerShell", "cmd", "Git Bash"]),
    async run(stage, ui) {
      await stage.typeLine(0, "Get-ChildItem -Recurse C:\\Windows\\System32 -ErrorAction SilentlyContinue", 22);
      await sleep(3200);
      await ui.ctrl("c");
      await sleep(900);
      await stage.typeLine(1, "exit 3", 70);
      await sleep(1200);
      await stage.typeLine(2, "exit", 70);
      await sleep(1000);
    },
  },

  // Theme, language and font size apply at once.
  settings: {
    prepare: async (stage) => {
      await stage.setLang("en");
      await stage.setSidebar(false);
      if ((await stage.count()) === 0) await stage.reset();
    },
    async run(stage, ui) {
      await ui.click(await stage.gear());
      await sleep(900);
      for (const [selector, ms] of [[".theme-green", 1500], [".theme-black", 1200]]) {
        await ui.click(await ui.at(selector));
        await sleep(ms);
      }
      await ui.click(await stage.atText(".lang-toggle .tb-button", "한국어"));
      await sleep(1500);
      await ui.click(await stage.atText(".lang-toggle .tb-button", "English"));
      await sleep(1000);
      for (const selector of [".tb-font-large", ".tb-font-small"]) {
        for (let i = 0; i < 3; i++) {
          await ui.click(await ui.at(selector));
          await sleep(550);
        }
        await sleep(400);
      }
      await ui.click(await stage.gear());
      await sleep(400);
    },
  },
};
