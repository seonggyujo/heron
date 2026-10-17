// A row of radio buttons for the settings panel: one is checked, and
// picking another checks it and reports it. Each option dresses its own
// button (text, class, label); the group keeps the checked state.

export interface RadioOption<T> {
  value: T;
  /** Sets the button's look: its class, text or label. */
  dress(button: HTMLButtonElement): void;
}

export function createRadioGroup<T>(
  className: string,
  label: string,
  options: readonly RadioOption<T>[],
  initial: T,
  onChange: (value: T) => void,
): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  el.setAttribute("role", "radiogroup");
  el.setAttribute("aria-label", label);

  let selected = initial;
  const buttons = options.map((option) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    option.dress(b);
    b.addEventListener("click", () => {
      if (option.value === selected) return;
      selected = option.value;
      render();
      onChange(option.value);
    });
    return b;
  });
  el.append(...buttons);

  function render(): void {
    buttons.forEach((b, i) => b.setAttribute("aria-checked", String(options[i].value === selected)));
  }

  render();
  return el;
}
