// Preferences through pref(): theme.ts, font-size.ts and shells.ts as well as
// prefs.ts itself, and Settings > Reset (reset.ts). Each test loads them
// afresh, since a pref reads its stored value when its module loads.
import { beforeEach, expect, test, vi } from "vitest";

const store = new Map<string, string>();
let broken = false;

/** localStorage over `store`; Object.keys() lists the stored keys, as reset.ts needs. */
const storage = new Proxy(
  {
    getItem: (k: string) => {
      if (broken) throw new Error("no storage");
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
  {
    ownKeys: () => [...store.keys()],
    getOwnPropertyDescriptor: (target, k) =>
      typeof k === "string" && store.has(k)
        ? { value: store.get(k), enumerable: true, configurable: true }
        : Reflect.getOwnPropertyDescriptor(target, k),
  },
);
const dataset: Record<string, string | undefined> = {};

beforeEach(() => {
  store.clear();
  broken = false;
  for (const k of Object.keys(dataset)) delete dataset[k];
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("document", { documentElement: { dataset } });
  vi.resetModules();
});

/** The modules as a fresh start finds them, with `saved` in storage. */
async function start(saved: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(saved)) store.set(k, v);
  return {
    theme: await import("./theme"),
    font: await import("./font-size"),
    shells: await import("./shells"),
    prefs: await import("./prefs"),
    reset: await import("./reset"),
  };
}

test("saved values are read at start", async () => {
  const { theme, font, shells, prefs } = await start({
    "heron.theme": "green",
    "heron.fontSize": "18",
    "heron.defaultShell": "cmd",
    "heron.motion": "false",
  });
  expect(theme.currentTheme()).toBe("green");
  expect(font.fontSizePref.get()).toBe(18);
  expect(shells.defaultShellOf(["pwsh", "cmd"])).toBe("cmd");
  expect(shells.defaultShellOf(["pwsh"]), "a saved shell no longer installed").toBe("pwsh");
  expect(prefs.motionPref.get()).toBe(false);
});

test("bad saved values fall back to the defaults", async () => {
  const { theme, font, shells } = await start({
    "heron.theme": "pink",
    "heron.fontSize": "30",
    "heron.defaultShell": "toString",
  });
  expect(theme.currentTheme()).toBe("black");
  expect(font.fontSizePref.get()).toBe(14);
  expect(shells.defaultShellPref.get()).toBeNull();
  expect(shells.defaultShellOf([])).toBe("powershell");
});

test("no storage at all: defaults, and nothing throws", async () => {
  broken = true;
  const { theme, font } = await start();
  expect([theme.currentTheme(), font.fontSizePref.get()]).toEqual(["black", 14]);
});

test("setTheme saves and shows; applying writes nothing", async () => {
  const { theme } = await start();
  theme.setTheme("green");
  expect([store.get("heron.theme"), dataset.theme]).toEqual(["green", undefined]);
  theme.setTheme("black");
  expect([store.get("heron.theme"), dataset.theme]).toEqual(["black", "black"]);
  store.clear();
  theme.applyTheme();
  expect(store.size).toBe(0);
});

test("reset: every pref back to its default and every heron.* key gone, the hooks choice kept", async () => {
  const { theme, font, shells, prefs, reset } = await start({ "heron.theme": "green", other: "x" });
  font.fontSizePref.set(20);
  shells.defaultShellPref.set("pwsh");
  prefs.motionPref.set(false);
  prefs.agentHooksWantedPref.set(true);
  reset.forgetSettings();
  expect([...store.keys()]).toEqual(["other"]);
  expect(theme.currentTheme()).toBe("black");
  expect(font.fontSizePref.get()).toBe(14);
  expect(shells.defaultShellOf(["gitbash", "cmd"])).toBe("gitbash");
  expect(prefs.motionPref.get()).toBe(true);
  expect(prefs.agentHooksWantedPref.get(), "the hooks stay in Claude Code's settings").toBe(true);
});
