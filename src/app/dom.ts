// Small DOM builders shared by the screen modules (ui/, pane/).

/** A span with a class and its text. */
export function span(className: string, text = ""): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return el;
}
