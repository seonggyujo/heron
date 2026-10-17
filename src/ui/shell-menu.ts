import { SHELL_LABELS } from "../app/shells";
import type { ShellKind } from "../ipc/pty";
import { createPopover } from "./popover";

// Dropdown listing the installed shells. The current default has a check
// mark. Opening and closing is popover.ts; picking an item closes it too.
// Up and Down move a highlight, Enter picks it (as in heron-c).

export interface ShellMenu {
  el: HTMLElement;
  toggle(anchor: HTMLElement): void;
  setDefault(shell: ShellKind): void;
}

function menuItem(role: string, mark: string, label: string, onClick: () => void): HTMLButtonElement {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "shell-menu-item";
  item.setAttribute("role", role);
  item.innerHTML = `<span class="shell-check">${mark}</span><span></span>`;
  item.lastElementChild!.textContent = label;
  item.addEventListener("click", onClick);
  return item;
}

export function createShellMenu(
  shells: ShellKind[],
  initial: ShellKind,
  onPick: (shell: ShellKind) => void,
): ShellMenu {
  const el = document.createElement("div");
  el.className = "shell-menu";
  el.setAttribute("role", "menu");
  let keyed = -1;
  const highlight = (index: number) => {
    keyed = index;
    items.forEach((item, i) => item.classList.toggle("keyed", i === index));
  };
  const onKey = (e: KeyboardEvent): boolean => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const step = e.key === "ArrowDown" ? 1 : -1;
      highlight(keyed < 0 ? (step > 0 ? 0 : items.length - 1) : (keyed + step + items.length) % items.length);
      return true;
    }
    if (e.key !== "Enter" || keyed < 0) return false;
    items[keyed].click();
    return true;
  };
  const popover = createPopover(el, () => highlight(-1), "right", onKey);

  const items = shells.map((shell) => {
    const item = menuItem("menuitemradio", "✓", SHELL_LABELS[shell], () => {
      popover.close();
      onPick(shell);
    });
    item.dataset.shell = shell;
    return item;
  });
  el.append(...items);

  const setDefault = (shell: ShellKind) => {
    items.forEach((i) => i.setAttribute("aria-checked", String(i.dataset.shell === shell)));
  };
  setDefault(initial);

  return { el, toggle: popover.toggle, setDefault };
}
