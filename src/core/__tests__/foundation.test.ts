import { describe, expect, it } from "vitest";
import { answerText, parseAnswerFor, sameAnswer } from "../answer";
import { parseEquation, parseExpression } from "../equation";
import { frac } from "../fraction";
import { checkArithmeticLine, checkEquationLine, checkExpressionLine, evaluateArithmetic } from "../lineCheck";

const expr = (x: number, c: number) => ({ kind: "expr" as const, x: frac(x), c: frac(c) });

describe("answers: numbers and expressions", () => {
  it("reads a number answer as before", () => {
    expect(parseAnswerFor("number", "−7/2")).toEqual({ ok: true, value: frac(-7, 2) });
  });

  it("reads an expression answer in any order, and compares by value", () => {
    const r = parseAnswerFor("expression", "7 + 2x");
    expect(r).toEqual({ ok: true, value: expr(2, 7) });
    if (r.ok) expect(sameAnswer(r.value, expr(2, 7))).toBe(true);
    expect(parseAnswerFor("expression", "2x + 3 + 4")).toEqual({ ok: true, value: expr(2, 7) });
    expect(parseAnswerFor("expression", "−x")).toEqual({ ok: true, value: expr(-1, 0) });
  });

  it("refuses an equation where an expression is wanted, with a message key", () => {
    expect(parseAnswerFor("expression", "x = 2")).toMatchObject({ ok: false, errorKey: "parse.extraEquals" });
    expect(parseAnswerFor("expression", "2y + 1")).toMatchObject({ ok: false });
  });

  it("never mixes a number and an expression", () => {
    expect(sameAnswer(frac(7), expr(0, 7))).toBe(false);
    expect(sameAnswer(frac(7), frac(14, 2))).toBe(true);
  });

  it("prints answers for storage and display", () => {
    expect(answerText(frac(-7, 2))).toBe("-7/2");
    expect(answerText(expr(2, 7))).toBe("2x + 7");
    expect(answerText(expr(-1, -3))).toBe("−x − 3");
    expect(answerText(expr(0, 5))).toBe("5");
    expect(answerText(expr(3, 0))).toBe("3x");
  });
});

describe("parseExpression", () => {
  it("reads a linear expression without =", () => {
    const r = parseExpression("3x + 5 − x + 2");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.side.expr).toEqual({ xCoef: frac(2), constant: frac(7) });
  });

  it("explains what is wrong, never throws", () => {
    expect(parseExpression("")).toMatchObject({ ok: false, errorKey: "parse.empty" });
    expect(parseExpression("2x = 4")).toMatchObject({ ok: false, errorKey: "parse.extraEquals" });
    expect(parseExpression("2x +")).toMatchObject({ ok: false, errorKey: "parse.signNeedsTerm" });
  });
});

describe("arithmetic lines (integers)", () => {
  it("evaluates whole-number arithmetic with brackets", () => {
    expect(evaluateArithmetic("5 − (−4)")).toEqual(frac(9));
    expect(evaluateArithmetic("−(7 − 3)")).toEqual(frac(-4));
    expect(() => evaluateArithmetic("x + 1")).toThrow();
  });

  it("accepts a line with the same value, refuses a copy of the line above, and wants one number at the end", () => {
    expect(checkArithmeticLine(frac(9), "5 − (−4)", "5 + 4", false)).toMatchObject({ ok: true, feedbackKey: "teach.fix.ok" });
    expect(checkArithmeticLine(frac(9), "5 − (−4)", "5 − 4", false)).toMatchObject({ ok: false, feedbackKey: "teach.fix.sameValue" });
    expect(checkArithmeticLine(frac(9), "5 + 4", "5+4", false)).toMatchObject({ ok: false, feedbackKey: "teach.fix.noProgress" });
    expect(checkArithmeticLine(frac(9), "5 + 4", "4 + 5", true)).toMatchObject({ ok: false, feedbackKey: "teach.fix.oneNumber" });
    expect(checkArithmeticLine(frac(9), "5 + 4", "9", true)).toMatchObject({ ok: true });
    expect(checkArithmeticLine(frac(9), "5 + 4", "nine", true)).toMatchObject({ ok: false, feedbackKey: "parse.arith" });
  });
});

describe("expression lines (like terms)", () => {
  const q = { xCoef: frac(2), constant: frac(7) };
  it("accepts an equal expression, wants the simplest form at the end", () => {
    expect(checkExpressionLine(q, "3x + 5 − x + 2", "3x − x + 5 + 2", false)).toMatchObject({ ok: true });
    expect(checkExpressionLine(q, "3x + 5 − x + 2", "3x + x + 5 + 2", false)).toMatchObject({ ok: false, feedbackKey: "teach.fix.sameExpr" });
    expect(checkExpressionLine(q, "3x − x + 5 + 2", "3x − x + 7", true)).toMatchObject({ ok: false, feedbackKey: "teach.fix.simplest" });
    expect(checkExpressionLine(q, "3x − x + 5 + 2", "2x + 7", true)).toMatchObject({ ok: true });
    expect(checkExpressionLine(q, "3x − x + 5 + 2", "3x−x+5+2", false)).toMatchObject({ ok: false, feedbackKey: "teach.fix.noProgress" });
  });
});

describe("equation lines (one-step and two-step)", () => {
  const q = (text: string) => {
    const r = parseEquation(text);
    if (!r.ok) throw new Error(text);
    return r.equation;
  };
  it("accepts an equivalent line, wants x = a number at the end", () => {
    expect(checkEquationLine(q("x + 7 = 3"), "x + 7 = 3", "x + 7 − 7 = 3 − 7", false)).toMatchObject({ ok: true });
    expect(checkEquationLine(q("x + 7 = 3"), "x + 7 = 3", "x = 3 + 7", false)).toMatchObject({ ok: false, feedbackKey: "teach.fix.notEqual" });
    expect(checkEquationLine(q("5x − 3 = −8"), "5x = −8 + 3", "5x = −5", false)).toMatchObject({ ok: true });
    expect(checkEquationLine(q("5x − 3 = −8"), "5x = −5", "5x = −5", false)).toMatchObject({ ok: false, feedbackKey: "teach.fix.noProgress" });
    expect(checkEquationLine(q("5x − 3 = −8"), "5x = −5", "−1 = x", true)).toMatchObject({ ok: false, feedbackKey: "teach.fix.xEquals" });
    expect(checkEquationLine(q("5x − 3 = −8"), "5x = −5", "x = −1", true)).toMatchObject({ ok: true });
  });
});
