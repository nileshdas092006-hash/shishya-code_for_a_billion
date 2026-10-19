import { parseExpression, type ParseErrorKey } from "./equation";
import { formatSide, type Term } from "./format";
import { equals, frac, toString, type Fraction } from "./fraction";
import type { Answer, AnswerKind, ExprAnswer } from "./types";

// Reads a child's typed final answer. Never throws.
//   number:     "5", "−3", "5/3", or "x = 5"
//   expression: "2x + 7" (alg.like-terms), in any order

/** English text for each answer error; src/i18n/en.ts reuses these. */
export const ANSWER_MESSAGES = {
  "answer.format": "Type your answer as a number, like 5, −3 or 5/3.",
  "answer.zeroDen": "The bottom number of a fraction cannot be 0.",
} as const;
export type AnswerErrorKey = keyof typeof ANSWER_MESSAGES;

export type AnswerResult = { ok: true; value: Fraction } | { ok: false; error: string; errorKey: AnswerErrorKey };
export type AnyAnswerResult = { ok: true; value: Answer } | { ok: false; error: string; errorKey: AnswerErrorKey | ParseErrorKey };

const failure = (key: AnswerErrorKey): AnswerResult => ({ ok: false, error: ANSWER_MESSAGES[key], errorKey: key });

export function parseAnswer(text: string): AnswerResult {
  const clean = String(text ?? "")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .trim()
    .replace(/\s*([=/-])\s*/g, "$1") // spaces around signs are fine; "1 2" is not "12"
    .replace(/^x=/, "");
  const m = /^(-?)(\d{1,6})(?:\/(\d{1,6}))?$/.exec(clean);
  if (!m) return failure("answer.format");
  const num = Number(m[2]) * (m[1] ? -1 : 1);
  const den = m[3] === undefined ? 1 : Number(m[3]);
  if (den === 0) return failure("answer.zeroDen");
  return { ok: true, value: frac(num, den) };
}

export const isExpr = (a: Answer): a is ExprAnswer => (a as ExprAnswer).kind === "expr";

/** For code that only handles number answers. */
export function asFraction(a: Answer): Fraction {
  if (isExpr(a)) throw new Error("expected a number answer, got an expression");
  return a;
}

/** Reads a typed answer for a skill's answer kind. */
export function parseAnswerFor(kind: AnswerKind, text: string): AnyAnswerResult {
  if (kind === "number") return parseAnswer(text);
  const r = parseExpression(text);
  if (!r.ok) return { ok: false, error: r.error, errorKey: r.errorKey };
  return { ok: true, value: { kind: "expr", x: r.side.expr.xCoef, c: r.side.expr.constant } };
}

export function sameAnswer(p: Answer, q: Answer): boolean {
  if (isExpr(p) || isExpr(q)) return isExpr(p) && isExpr(q) && equals(p.x, q.x) && equals(p.c, q.c);
  return equals(p, q);
}

/** Text for storage and display: numbers as "-7/2" (as before); expressions as "2x + 7". */
export function answerText(a: Answer): string {
  if (!isExpr(a)) return toString(a);
  const terms: Term[] = [];
  if (a.x.num !== 0) terms.push([a.x.num / a.x.den, true]);
  if (a.c.num !== 0 || terms.length === 0) terms.push([a.c.num / a.c.den, false]);
  return formatSide(terms);
}
