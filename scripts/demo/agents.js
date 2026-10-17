// The README's first GIF (docs/media/agents.gif, and agents.ko.gif with the
// UI in Korean): three Claude Code sessions side by side each get a prompt,
// and the sidebar and the herons follow them until one works (a long ping),
// one waits for permission and one is done. These are real sessions on Haiku
// with tiny prompts, run as you (your login, hooks and heron-limits plugin)
// in folders under ~/demo, so recording them uses a little of your plan.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { REC_DIR } from "./paths.js";

const DEMO_HOME = path.join(os.homedir(), "demo");

// Top left, top right, wide at the bottom. web-client asks before it runs a
// command; the others run in your default permission mode.
const SESSIONS = [
  {
    folder: "payments-api",
    prompt: {
      en: "Run ping -n 300 127.0.0.1 with the Bash tool, then reply done.",
      ko: "Bash 도구로 ping -n 300 127.0.0.1을 실행하고, 끝나면 done이라고 답해 줘.",
    },
  },
  {
    folder: "web-client",
    flags: " --permission-mode default",
    prompt: { en: "Run npm outdated to check for outdated packages.", ko: "npm outdated를 실행해서 오래된 패키지를 확인해 줘." },
  },
  {
    folder: "docs-site",
    prompt: {
      en: "In one short English sentence: what does a heron do while it fishes?",
      ko: "한 문장으로 짧게: 왜가리는 물고기를 잡을 때 무엇을 하나요?",
    },
  },
];
const SETTLED = "work,need,done";
// Claude Code's own language (answers, session titles), whatever yours is.
const LANGUAGE = { en: "English", ko: "Korean" };

function makeFolders() {
  for (const { folder } of SESSIONS) fs.mkdirSync(path.join(DEMO_HOME, folder), { recursive: true });
  const pkg = { name: "web-client", private: true, dependencies: { react: "^17.0.2", vite: "^4.5.0" } };
  fs.writeFileSync(path.join(DEMO_HOME, "web-client", "package.json"), JSON.stringify(pkg, null, 2) + "\n");
}

/** A settings file for `claude --settings`, on top of your own settings. */
function languageSettings(lang) {
  const file = path.join(REC_DIR, `claude-${lang}.json`);
  fs.writeFileSync(file, JSON.stringify({ language: LANGUAGE[lang] }));
  return file;
}

/** The sidebar row's mark for each session: work, need, done, idle (agent-model.ts markOf), or "" before it shows. */
const marks = (cdp) =>
  cdp.js(
    `${JSON.stringify(SESSIONS.map((s) => s.folder))}.map((folder) => {` +
      ` const row = [...document.querySelectorAll(".agent-item")].find((r) => r.textContent.includes(folder));` +
      ` return row ? ["work", "need", "done", "idle"].find((m) => row.classList.contains(m)) ?? "" : ""; }).join(",")`,
  );

function agentsScene(lang) {
  return {
    async prepare(stage) {
      makeFolders();
      const settings = languageSettings(lang);
      await stage.setLang(lang);
      await stage.setSidebar(true);
      await stage.reset(SESSIONS.map(() => "PowerShell"));
      for (const [i, s] of SESSIONS.entries()) {
        // A line of its own, so the next prompt tells Heron the folder.
        await stage.typeLine(i, `cd ~\\demo\\${s.folder}`, 4);
        await sleep(700);
        // The app was started without your Claude Code config; Claude Code gets it back.
        const claude = `claude --model haiku --settings "${settings}"${s.flags ?? ""}`;
        await stage.typeLine(i, `Remove-Item Env:CLAUDE_CONFIG_DIR; cls; ${claude}`, 4);
      }
      const end = Date.now() + 60_000;
      while (!(await marks(stage.cdp)).split(",").every(Boolean)) {
        if (Date.now() > end) throw new Error("Claude Code did not start in every pane");
        await sleep(500);
      }
      await sleep(4000); // until each prompt box takes input
    },

    async run(stage, ui) {
      await sleep(600);
      // The question first, so it is answered while the others get going.
      for (const i of [2, 1, 0]) {
        await stage.typeLine(i, SESSIONS[i].prompt[lang], 28);
        await sleep(500);
      }
      await stage.park();
      const end = Date.now() + 120_000;
      for (let now = await marks(stage.cdp); now !== SETTLED; now = await marks(stage.cdp)) {
        // Your default mode asked about the ping: allow it (the first choice).
        if (now.startsWith("need")) {
          await ui.click(await stage.paneBody(0));
          await ui.enter();
          await stage.park();
        }
        if (Date.now() > end) throw new Error(`the sessions did not settle: ${now}`);
        await sleep(400);
      }
      await sleep(7000); // the herons at it
    },
  };
}

export const AGENT_SCENES = { agents: agentsScene("en"), "agents.ko": agentsScene("ko") };
