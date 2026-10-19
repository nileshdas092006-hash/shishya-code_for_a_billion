import { describe, expect, it } from "vitest";
import { parseAnswer } from "../answer";
import { diagnose } from "../diagnose";
import { frac, toString } from "../fraction";
import { evaluate, renderLine, toMistake, validateMinedMistake, type MinedMistakeSpec, type UnknownError } from "../minedMistake";
import { createRng } from "../rng";
import { linearBothSides, makeInstance } from "../skills/linear-both-sides";

const P = { a: 4, b: -3, c: 2, d: 7 }; // 4x − 3 = 2x + 7

/** "Divides by the original coefficient a": the mistake deliberately left out of the authored list. */
const DIVIDE_BY_A: MinedMistakeSpec = {
  id: "divided-by-a",
  label: "Divided by the x-coefficient from the question instead of the collected one: x = (d − b) / a",
  childLabel: "After you collect the x-terms, divide both sides by the number in front of x in that line, not the one in the question.",
  stepType: "divide",
  firstWrongLine: 5,
  lines: { "5": "x = {(d - b) / a}" },
  answerFormula: "(d - b) / a",
};

/** Six logged unknown wrong answers that "divide by a" explains (5/2 for 4x − 3 = 2x + 7, and others). */
function unknownErrorsFor(formula: (p: Record<string, number>) => string, n = 6, onlyUnknown = true): UnknownError[] {
  const out: UnknownError[] = [{ params: P, wrongAnswer: formula(P), count: 3 }];
  for (let seed = 1; out.length < n; seed++) {
    const inst = linearBothSides.generate(createRng(seed));
    const wrong = formula(inst.params);
    const typed = parseAnswer(wrong);
    if (!typed.ok || (onlyUnknown && diagnose(linearBothSides, inst, typed.value) !== "unknown")) continue;
    out.push({ params: inst.params, wrongAnswer: wrong, count: 1 });
  }
  return out;
}
const divideByA = (p: Record<string, number>) => toString(frac(p.d - p.b, p.a));
const ERRORS = unknownErrorsFor(divideByA);
const ctx = { skill: linearBothSides, unknownErrors: ERRORS, existing: linearBothSides.mistakes };

describe("evaluate (our own tiny arithmetic, no eval)", () => {
  it.each([
    ["(d - b) / a", frac(5, 2)],
    ["d − b ÷ a", frac(31, 4)],
    ["(a + c) × 2 - -3", frac(15)],
    ["-a * (b - 1)", frac(16)],
    ["12 / 8", frac(3, 2)],
  ])("%s", (formula, value) => {
    expect(evaluate(formula, P)).toEqual(value);
  });

  it("refuses division by zero", () => {
    expect(() => evaluate("d / (a - a)", P)).toThrow(/zero/i);
  });

  it.each(["Math.max(a, b)", "e", "a b", "2a", "a ** 2", "eval(1)", "constructor", "(a + b", "a +", "", "a; b", "1.5 * a", "a % b"])(
    "rejects %j",
    (formula) => {
      expect(() => evaluate(formula, P)).toThrow();
    },
  );

  it("rejects very long input", () => {
    expect(() => evaluate("a + ".repeat(200) + "a", P)).toThrow();
  });
});

describe("renderLine", () => {
  it("fills {formulas} and prints the line like the Shishya's other lines", () => {
    expect(renderLine("{a}x + {b} = {d}", P)).toBe("4x − 3 = 7");
    expect(renderLine("{a - c}x = {d - b}", P)).toBe("2x = 10");
    expect(renderLine("{a - 3}x = {d}", P)).toBe("x = 7");
    expect(renderLine("x = {(d - b) / a}", P)).toBe("x = 5/2");
  });

  it("rejects anything but x, numbers, + − = and {formulas}", () => {
    expect(() => renderLine("y = {a}", P)).toThrow();
    expect(() => renderLine("<script> = {a}", P)).toThrow();
    expect(() => renderLine("{a}x = {d} / 2", P)).toThrow();
  });
});

describe("toMistake", () => {
  it("builds the Shishya's wrong trace: correct lines before the first wrong line, then the template", () => {
    const m = toMistake(DIVIDE_BY_A, linearBothSides);
    expect(m.origin).toBe("mined");
    const out = m.apply(makeInstance(P, 0));
    expect(out.trace.map((l) => l.text)).toEqual(["4x − 3 = 2x + 7", "4x − 2x − 3 = 7", "4x − 2x = 7 + 3", "2x = 10", "x = 5/2"]);
    expect(out.answer).toEqual(frac(5, 2));
    expect(out.firstWrongLine).toBe(5);
  });
});

describe("validateMinedMistake", () => {
  it("accepts 'divides by a' for 6 logged unknown errors", () => {
    const r = validateMinedMistake(DIVIDE_BY_A, ctx);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.reproduced).toBe(6);
  });

  it("needs at least 3 logged unknown wrong answers that it reproduces", () => {
    const r = validateMinedMistake(DIVIDE_BY_A, { ...ctx, unknownErrors: ERRORS.slice(0, 2) });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/at least 3/);
  });

  it("rejects a formula that gives the correct answer", () => {
    const r = validateMinedMistake(
      { ...DIVIDE_BY_A, lines: { "5": "x = {(d - b) / (a - c)}" }, answerFormula: "(d - b) / (a - c)" },
      { ...ctx, unknownErrors: unknownErrorsFor((p) => toString(frac(p.d - p.b, p.a - p.c))) },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/correct answer/);
  });

  it("rejects a copy of an existing mistake (forgot-to-divide: d − b)", () => {
    const r = validateMinedMistake(
      { ...DIVIDE_BY_A, id: "copy", lines: { "5": "x = {d - b}" }, answerFormula: "d - b" },
      { ...ctx, unknownErrors: unknownErrorsFor((p) => String(p.d - p.b), 6, false) },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/forgot-to-divide/);
  });

  it("rejects a formula that can divide by zero", () => {
    const r = validateMinedMistake({ ...DIVIDE_BY_A, lines: { "5": "x = {(d - b) / (a + b)}" }, answerFormula: "(d - b) / (a + b)" }, ctx);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/zero|reproduce/);
  });

  it("rejects symbols outside a, b, c, d, numbers, + − × ÷ and brackets", () => {
    const r = validateMinedMistake({ ...DIVIDE_BY_A, answerFormula: "Math.round((d - b) / a)" }, ctx);
    expect(r.ok).toBe(false);
  });

  it("rejects a last line that is not x = <answerFormula>", () => {
    const r = validateMinedMistake({ ...DIVIDE_BY_A, lines: { "5": "x = {d - b}" } }, ctx);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/last line/);
  });

  it("rejects a first wrong line that is still equivalent to the question", () => {
    const r = validateMinedMistake(
      {
        ...DIVIDE_BY_A,
        firstWrongLine: 4,
        lines: { "4": "{a - c}x - {d - b} = 0", "5": "x = {(d - b) / a}" },
      },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/equivalent|same as the correct/);
  });

  it.each([
    [{ id: "kept-x-sign" }, /already/],
    [{ id: "Bad Id!" }, /id/],
    [{ firstWrongLine: 1 }, /firstWrongLine/],
    [{ firstWrongLine: 5, lines: { "4": "x = 1", "5": "x = {(d - b) / a}" } }, /lines/],
    [{ stepType: "magic" }, /stepType/],
    [{ childLabel: "Move it across and change the sign." }, /NCERT/],
    [{ label: "" }, /label/],
  ])("rejects bad shape %j", (patch, message) => {
    const r = validateMinedMistake({ ...DIVIDE_BY_A, ...patch } as MinedMistakeSpec, ctx);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(message);
  });

  it("never throws, even on junk input", () => {
    for (const junk of [null, 42, "x", [], {}, { lines: null }, { answerFormula: {} }]) {
      expect(() => validateMinedMistake(junk, ctx)).not.toThrow();
      expect(validateMinedMistake(junk, ctx).ok).toBe(false);
    }
  });

  it("once added, diagnosis names it (and still names the authored ones)", () => {
    const skill = { ...linearBothSides, mistakes: [...linearBothSides.mistakes, toMistake(DIVIDE_BY_A, linearBothSides)] };
    const inst = makeInstance(P, 0);
    expect(diagnose(skill, inst, frac(5, 2))).toBe("divided-by-a");
    expect(diagnose(skill, inst, frac(5, 3))).toBe("kept-x-sign");
  });
});
