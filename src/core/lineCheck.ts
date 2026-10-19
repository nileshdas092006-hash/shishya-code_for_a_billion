import { equivalent, fill, parseEquation, parseExpression, PARSE_MESSAGES, type Equation, type Linear, type MessageParams } from "./equation";
import { equals, type Fraction } from "./fraction";
import { evaluate } from "./minedMistake";
import type { LineCheck } from "./types";

// Shared checks for a child's typed line in "Teach the Shishya". Each skill's checkLine() uses one of them
// (alg.linear.both-sides keeps its own line-by-line target forms). The rule everywhere: the line must still be
// equal to the question, it must be a real step (not a copy of the line above), and the last line must be the
// final form. Messages use NCERT words; src/i18n/en.ts reuses them.

export const LINE_MESSAGES = {
  "teach.fix.ok": "Well done! You found the Shishya's mistake and fixed it. Both sides are still equal.",
  "teach.fix.notEqual":
    "This line does not keep both sides equal to the question. Whatever you do to one side, do the same operation on the other side.",
  "teach.fix.shape.2":
    "Both sides are still equal, but there is still an x-term on the right side. Remove it by doing the same operation on both sides.",
  "teach.fix.shape.3": "Both sides are still equal. Now keep only x-terms on the left side and only numbers on the right side.",
  "teach.fix.shape.4": "Both sides are still equal. Now combine the x-terms into one term and the numbers into one number.",
  "teach.fix.shape.5": "Both sides are still equal. Now divide both sides by the number in front of x, so the left side is just x.",
  "teach.fix.sameValue": "This line does not have the same value as the question. Check each sign and each number.",
  "teach.fix.sameExpr": "This line is not equal to the question. Add like terms to each other, and keep every term with its sign.",
  "teach.fix.noProgress": "This is the same as the line above. Write the next step.",
  "teach.fix.oneNumber": "On the last line, write just one number.",
  "teach.fix.simplest": "On the last line, write the simplest form: one x-term and one number.",
  "teach.fix.xEquals": "On the last line, write x = a number.",
} as const;
export type LineMessageKey = keyof typeof LINE_MESSAGES;

export const lineResult = (ok: boolean, key: LineMessageKey, params?: MessageParams): LineCheck => ({
  ok,
  feedback: fill(LINE_MESSAGES[key], params),
  feedbackKey: key,
  ...(params ? { feedbackParams: params } : {}),
});

const parseFailure = (r: { error: string; errorKey: string; errorParams?: MessageParams }): LineCheck => ({
  ok: false,
  feedback: r.error,
  feedbackKey: r.errorKey,
  ...(r.errorParams ? { feedbackParams: r.errorParams } : {}),
});

/** Same text, ignoring spaces and which minus sign was typed. */
const sameText = (p: string, q: string) => {
  const norm = (s: string) => s.replace(/[−–—]/g, "-").replace(/\s+/g, "").toLowerCase();
  return norm(p) === norm(q);
};

/** Whole-number arithmetic with brackets, e.g. "5 − (−4)". Throws if it is anything else. */
export function evaluateArithmetic(text: string): Fraction {
  if (/[a-z]/i.test(text)) throw new Error("letters are not allowed here");
  return evaluate(text, {});
}

/** alg.integers.ops: same value as the question; the last line is one number. */
export function checkArithmeticLine(value: Fraction, prevLine: string, typed: string, isLast: boolean): LineCheck {
  let v: Fraction;
  try {
    v = evaluateArithmetic(typed);
  } catch {
    return parseFailure({ error: PARSE_MESSAGES["parse.arith"], errorKey: "parse.arith" });
  }
  if (sameText(typed, prevLine)) return lineResult(false, "teach.fix.noProgress");
  if (!equals(v, value)) return lineResult(false, "teach.fix.sameValue");
  if (isLast && !/^\(?[-−]?\d+\)?$/.test(typed.replace(/\s+/g, ""))) return lineResult(false, "teach.fix.oneNumber");
  return lineResult(true, "teach.fix.ok");
}

/** alg.like-terms: the same expression as the question; the last line is the simplest form. */
export function checkExpressionLine(question: Linear, prevLine: string, typed: string, isLast: boolean): LineCheck {
  const r = parseExpression(typed);
  if (!r.ok) return parseFailure(r);
  if (sameText(typed, prevLine)) return lineResult(false, "teach.fix.noProgress");
  const e = r.side.expr;
  if (!equals(e.xCoef, question.xCoef) || !equals(e.constant, question.constant)) return lineResult(false, "teach.fix.sameExpr");
  if (isLast) {
    const xTerms = r.side.terms.filter((t) => t.hasX);
    const numbers = r.side.terms.filter((t) => !t.hasX);
    if (xTerms.length > 1 || numbers.length > 1 || r.side.terms.some((t) => t.coef.num === 0)) return lineResult(false, "teach.fix.simplest");
  }
  return lineResult(true, "teach.fix.ok");
}

/** One-step and two-step equations: equivalent to the question; the last line is x = a number. */
export function checkEquationLine(question: Equation, prevLine: string, typed: string, isLast: boolean): LineCheck {
  const r = parseEquation(typed);
  if (!r.ok) return parseFailure(r);
  if (sameText(typed, prevLine)) return lineResult(false, "teach.fix.noProgress");
  if (!equivalent(r.equation, question)) return lineResult(false, "teach.fix.notEqual");
  if (isLast) {
    const { left, right } = r.equation;
    const xAlone = left.terms.length === 1 && left.terms[0].hasX && left.terms[0].coef.num === 1 && left.terms[0].coef.den === 1;
    if (!xAlone || right.terms.length !== 1 || right.terms[0].hasX) return lineResult(false, "teach.fix.xEquals");
  }
  return lineResult(true, "teach.fix.ok");
}
