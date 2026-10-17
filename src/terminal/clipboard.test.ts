import type { Terminal } from "@xterm/xterm";
import { expect, test } from "vitest";
import { pasteInto } from "./clipboard";

/** Just what pasteInto reads of a terminal. */
function fakeTerminal(bracketed: boolean, pasted: string[]): Terminal {
  return { modes: { bracketedPasteMode: bracketed }, paste: (text: string) => pasted.push(text) } as unknown as Terminal;
}

test("ESC is dropped from a bracketed paste, so it cannot end the bracket", () => {
  const pasted: string[] = [];
  pasteInto(fakeTerminal(true, pasted), "a\x1b[201~rm -rf x\x1b");
  expect(pasted).toEqual(["a[201~rm -rf x"]);
});

test("without bracketed paste the text goes as it is", () => {
  const pasted: string[] = [];
  pasteInto(fakeTerminal(false, pasted), "a\x1bb");
  expect(pasted).toEqual(["a\x1bb"]);
});
