import { describe, expect, it } from "vitest";
import { parseAnswer, parseAnswerFor, sameAnswer } from "../answer";
import { parseEquation, parseExpression } from "../equation";
import { frac, toString } from "../fraction";
import { checkArithLine, checkEquationLine } from "../lineCheck";
import { normaliseInput } from "../normalise";
import { createRng, randInt } from "../rng";

// A child who knows the answer must never be marked wrong for how a keyboard typed it: phones send many
// different minus signs, Hindi keyboards send Devanagari digits, some keyboards send full-width characters.

const MINUSES = ["-", "−", "‐", "‑", "‒", "–", "—", "―", "﹣", "－"];
const SPACES = [" ", " ", " ", " ", " ", " ", "　"];
const devanagari = (s: string) => s.replace(/[0-9]/g, (d) => String.fromCharCode(0x0966 + Number(d)));
const fullWidth = (s: string) => s.replace(/[0-9]/g, (d) => String.fromCharCode(0xff10 + Number(d)));

describe("normaliseInput", () => {
  it("turns every dash and minus into -", () => {
    for (const m of MINUSES) expect(normaliseInput(`${m}7`)).toBe("-7");
  });

  it("turns Devanagari and full-width digits into 0–9", () => {
    expect(normaliseInput("०१२३४५६७८९")).toBe("0123456789");
    expect(normaliseInput("０１２３４５６７８９")).toBe("0123456789");
  });

  it("turns X and full-width x into x, but never × (it means multiply)", () => {
    expect(normaliseInput("X")).toBe("x");
    expect(normaliseInput("ｘ")).toBe("x");
    expect(normaliseInput("Ｘ")).toBe("x");
    expect(normaliseInput("3×2")).toBe("3×2");
  });

  it("turns full-width = / + into = / +, and leaves ÷ alone (only a final answer reads ÷)", () => {
    expect(normaliseInput("x＝5")).toBe("x=5");
    expect(normaliseInput("5／3")).toBe("5/3");
    expect(normaliseInput("2x＋3")).toBe("2x+3");
    expect(normaliseInput("10÷2")).toBe("10÷2");
  });

  it("turns NBSP and other Unicode spaces into a normal space and drops zero-width characters", () => {
    for (const s of SPACES) expect(normaliseInput(`x${s}=${s}5`)).toBe("x = 5");
    expect(normaliseInput("1​2")).toBe("12");
  });
});

describe("number answers in every keyboard style (property test over 1,000 answers)", () => {
  it("any minus, Devanagari or full-width digits, any form → the same fraction, and sameAnswer is true", () => {
    const rng = createRng(4404);
    for (let i = 0; i < 1000; i++) {
      const correct = frac(randInt(rng, -99, 99), randInt(rng, 1, 9));
      const plain = toString(correct);
      const minus = MINUSES[randInt(rng, 0, MINUSES.length - 1)];
      const space = SPACES[randInt(rng, 0, SPACES.length - 1)];
      const withMinus = plain.replace("-", minus);
      const forms = [
        withMinus,
        devanagari(withMinus),
        fullWidth(withMinus),
        `x${space}=${space}${withMinus}`,
        `X=${devanagari(withMinus)}`,
        `${fullWidth(withMinus)} = x`,
        `ｘ＝${withMinus}`,
      ];
      for (const text of forms) {
        const r = parseAnswer(text);
        expect(r, text).toEqual({ ok: true, value: correct });
        if (r.ok) expect(sameAnswer(r.value, correct)).toBe(true);
      }
    }
  });
});

describe("answer forms", () => {
  it.each([
    ["7", 7],
    ["x = 7", 7],
    ["x=7", 7],
    ["7 = x", 7],
    ["7=x", 7],
    ["X = 7", 7],
    ["+7", 7],
    ["x = +7", 7],
    ["14/2", 7],
    ["10÷2", 5],
    ["−3 = x", -3],
  ])("reads %j", (text, n) => {
    const r = parseAnswer(text);
    expect(r).toEqual({ ok: true, value: frac(n) });
  });

  it('"7 = x" is the same answer as "x = 7"; "14/2" is still an exact fraction', () => {
    const a = parseAnswer("7 = x");
    const b = parseAnswer("x = 7");
    expect(a.ok && b.ok && sameAnswer(a.value, b.value)).toBe(true);
    expect(parseAnswer("14/2")).toEqual({ ok: true, value: frac(7) });
  });

  it.each(["1 2", "१ २", "x = 7 = x", "7 = 7", "x = x", "++7", "+-7", "10÷0", "3×2", "x7"])("still refuses %j", (text) => {
    expect(parseAnswer(text).ok).toBe(false);
  });

  it("an expression answer reads full-width and Devanagari too, but never ÷", () => {
    expect(parseAnswerFor("expression", "२x − ३")).toEqual({ ok: true, value: { kind: "expr", x: frac(2), c: frac(-3) } });
    expect(parseExpression("ｘ＋５").ok).toBe(true);
    expect(parseExpression("10÷2").ok).toBe(false);
  });

  it("the error message shows an example in the keypad's own format", () => {
    const r = parseAnswer("abc");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("-3");
      expect(r.error).toContain("x = 5");
    }
  });
});

describe("the line checker reads every keyboard style", () => {
  const q = parseEquation("2x + 3 = 11");
  if (!q.ok) throw new Error("bad fixture");

  it("accepts a correct line typed with Devanagari digits and U+2212", () => {
    expect(checkEquationLine(q.equation, "2x + 3 = 11", "२x = ११ − ३", false)).toMatchObject({ ok: true, feedbackKey: "teach.fix.ok" });
    expect(checkEquationLine(q.equation, "2x = 8", "X = ४", true)).toMatchObject({ ok: true, feedbackKey: "teach.fix.ok" });
  });

  it("a copy of the line above in another keyboard style is still not a new step", () => {
    expect(checkEquationLine(q.equation, "2x = 8", "२x ＝ ８", false)).toMatchObject({ ok: false, feedbackKey: "teach.fix.noProgress" });
  });

  it("arithmetic lines read them too", () => {
    expect(checkArithLine(frac(9), "5 − (−4)", "५ + ४", false)).toMatchObject({ ok: true });
    expect(checkArithLine(frac(-1), "3 − 4", "－１", true)).toMatchObject({ ok: true });
  });
});
