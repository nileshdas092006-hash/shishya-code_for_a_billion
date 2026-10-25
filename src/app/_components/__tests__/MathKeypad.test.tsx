import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseAnswer } from "@/core/answer";
import { en } from "@/i18n/en";
import { hi } from "@/i18n/hi";
import { applyKey, KEYPAD_KEYS, type KeypadKey } from "../../_lib/keypad";
import { MathKeypad } from "../MathKeypad";

// A 12-year-old in a school lab cannot always find "−", "x" and "=" on a worn keyboard. The keypad under the
// answer box types them, at the cursor of the answer box. (Tests run in node without a DOM: the render test
// uses the server render, and a tap is the pure applyKey step the keypad runs on each key.)

const html = renderToStaticMarkup(<MathKeypad value="" onChange={() => {}} />);
const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);

describe("MathKeypad renders", () => {
  it("has every key: digits, −, x, +, =, /, delete and Clear", () => {
    for (const d of "0123456789") expect(buttons.some((b) => b.includes(`aria-label="${d}"`)), d).toBe(true);
    for (const label of ["minus", "x", "plus", "equals", "divide", "delete", "Clear"]) {
      expect(buttons.some((b) => b.includes(`aria-label="${label}"`)), label).toBe(true);
    }
    expect(buttons).toHaveLength(KEYPAD_KEYS.length);
    expect(html).toContain("−");
    expect(html).toContain("⌫");
    expect(html).toContain(en["keypad.clear"]);
  });

  it("digits are in phone order 7 8 9 / 4 5 6 / 1 2 3 / − 0 x", () => {
    const order = buttons.map((b) => /aria-label="([^"]+)"/.exec(b)![1]);
    expect(order.slice(0, 12)).toEqual(["7", "8", "9", "4", "5", "6", "1", "2", "3", "minus", "0", "x"]);
  });

  it("every key is at least 48×48 px with big text, and never submits the form", () => {
    for (const b of buttons) {
      expect(b).toMatch(/class="[^"]*\bmin-h-12\b/);
      expect(b).toMatch(/class="[^"]*\bmin-w-12\b/);
      expect(b).toMatch(/class="[^"]*\btext-2xl\b/);
      expect(b).toContain('type="button"');
    }
  });

  it("waits for the page to be ready, like every JavaScript button (taps are never lost)", () => {
    for (const b of buttons) expect(b).toContain('data-ready="no"');
  });

  it("is a labelled group, with labels in English and Hindi", () => {
    expect(html).toMatch(/role="group"[^>]*aria-label="Maths keypad"/);
    for (const k of ["keypad.label", "keypad.minus", "keypad.plus", "keypad.equals", "keypad.divide", "keypad.delete", "keypad.clear"] as const) {
      expect(en[k], k).toBeTruthy();
      expect(hi[k], k).toBeTruthy();
    }
  });
});

describe("a tap types at the cursor", () => {
  const tap = (keys: KeypadKey[], start = { value: "", from: 0, to: 0 }) =>
    keys.reduce((s, k) => {
      const r = applyKey(s.value, s.from, s.to, k);
      return { value: r.value, from: r.cursor, to: r.cursor };
    }, start);

  it('tapping "−" then "7" fills "-7", which reads as −7', () => {
    const r = tap(["minus", "7"]);
    expect(r.value).toBe("-7");
    expect(r.from).toBe(2);
    expect(parseAnswer(r.value)).toMatchObject({ ok: true });
  });

  it("x, =, / and + type their signs", () => {
    expect(tap(["x", "equals", "5", "divide", "3"]).value).toBe("x=5/3");
    expect(tap(["2", "x", "plus", "3"]).value).toBe("2x+3");
  });

  it("inserts in the middle at the cursor, and replaces a selection", () => {
    expect(applyKey("2x=8", 1, 1, "0")).toEqual({ value: "20x=8", cursor: 2 });
    expect(applyKey("2x=8", 3, 4, "4")).toEqual({ value: "2x=4", cursor: 4 });
  });

  it("delete removes the character before the cursor, or the selection; Clear empties the box", () => {
    expect(applyKey("-7", 2, 2, "delete")).toEqual({ value: "-", cursor: 1 });
    expect(applyKey("-7", 0, 0, "delete")).toEqual({ value: "-7", cursor: 0 });
    expect(applyKey("12345", 1, 4, "delete")).toEqual({ value: "15", cursor: 1 });
    expect(applyKey("x=7", 1, 1, "clear")).toEqual({ value: "", cursor: 0 });
  });
});

describe("the keypad is under the answer box on Practise, Prove and Teach", () => {
  it.each(["s/practise/[skill]/PractiseScreen.tsx", "s/prove/[skill]/ProveScreen.tsx", "s/teach/[skill]/TeachScreen.tsx"])("%s", (f) => {
    const src = readFileSync(join(__dirname, "..", "..", f), "utf8");
    expect(src).toMatch(/<MathKeypad\b[^>]*inputRef=\{/);
  });
});
