import type { Lang } from "../i18n/lang";
import { createRadioGroup } from "./radio-group";

// Language choice in the settings panel. Each language is named in itself,
// so it can be found whatever the current language is.

const LANGS: { id: Lang; name: string }[] = [
  { id: "en", name: "English" },
  { id: "ko", name: "한국어" },
];

export function createLangToggle(initial: Lang, label: string, onChange: (lang: Lang) => void): HTMLElement {
  const options = LANGS.map(({ id, name }) => ({
    value: id,
    dress(b: HTMLButtonElement) {
      b.className = "tb-button";
      b.lang = id;
      b.textContent = name;
    },
  }));
  return createRadioGroup("tb-group lang-toggle", label, options, initial, onChange);
}
