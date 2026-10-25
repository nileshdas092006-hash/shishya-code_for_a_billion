import { answerText, isExpr } from "./answer";
import { parseEquation, parseExpression, root, type Equation, type Term } from "./equation";
import { formatSide, fracText, MINUS } from "./format";
import { add, equals, frac, mul, sub, type Fraction } from "./fraction";
import { evaluateArithmetic } from "./lineCheck";
import { normaliseInput } from "./normalise";
import type { Answer, Instance, Mistake } from "./types";

// Receipts: the short proof under every verdict, the way NCERT teaches checking ("put the answer back in").
// They are data, not sentences, so the screens translate them (src/i18n). Display strings use exact fractions and
// the real minus sign. A wrong answer's receipt shows the check that does NOT hold, and never the correct answer.

/** Both sides of an equation worked out for one value of x. */
export type Substitution = { x: string; left: string; right: string; leftValue: string; rightValue: string; holds: boolean };
/** Two expressions worked out for one value of x. */
export type Comparison<A extends string, B extends string> = { x: string; holds: boolean } & Record<A | `${A}Value` | B | `${B}Value`, string>;

export type SignRule = "same-signs" | "different-signs";

export type AnswerReceipt =
  /** Equations: the child's value put back into the original equation. */
  | ({ kind: "substitute" } & Substitution)
  /** Integers: the sign rule for the sum, and a check that undoes the addition (answer − second number = first number; back is what it gives). */
  | { kind: "integer"; expr: string; value: string; rule: SignRule; check: string; back: string; start: string; holds: boolean }
  /** Like terms, a right answer: the x-terms added, the numbers added. */
  | { kind: "collect"; xTerms: string; numbers: string; result: string; holds: true }
  /** Like terms, a wrong answer: the question and the answer worked out for one x where they differ. */
  | ({ kind: "compare" } & Comparison<"question", "answer">);

export type LineReceipt =
  /** Equation skills: the typed line's solution, put back into the line above. */
  | { kind: "line"; sameSolution: boolean; solution: string | null; check: Substitution | null }
  /** Expression skills: the line above and the typed line worked out for one x (sums: just their values). */
  | { kind: "line"; sameValue: boolean; value: string | null; check: Comparison<"above", "line"> | null };

/** A value inside a worked-out line: brackets round a negative number or a fraction, (−2) and (5/3). */
const br = (v: Fraction) => (v.num < 0 || v.den !== 1 ? `(${fracText(v)})` : fracText(v));

/** The terms with x replaced by v, e.g. "4×(−2) − 3", and their value. */
function putIn(terms: Term[], v: Fraction): { text: string; value: Fraction } {
  let value = frac(0);
  const parts = terms.map((t, i) => {
    value = add(value, t.hasX ? mul(t.coef, v) : t.coef);
    const size = frac(Math.abs(t.coef.num), t.coef.den);
    const body = !t.hasX ? fracText(size) : equals(size, frac(1)) ? br(v) : `${fracText(size)}×${br(v)}`;
    const negative = t.coef.num < 0;
    if (i === 0) return negative ? `${MINUS}${body}` : body;
    return negative ? ` ${MINUS} ${body}` : ` + ${body}`;
  });
  return { text: parts.join(""), value };
}

/** "3×7 + 5 = 26", or just "26" for a side that is one number. */
function worked(terms: Term[], v: Fraction): { text: string; value: Fraction } {
  const { text, value } = putIn(terms, v);
  const lone = terms.length === 1 && !terms[0].hasX;
  return { text: lone ? fracText(value) : `${text} = ${fracText(value)}`, value };
}

function substitution(eq: Equation, v: Fraction): Substitution {
  const l = worked(eq.left.terms, v);
  const r = worked(eq.right.terms, v);
  return { x: fracText(v), left: l.text, right: r.text, leftValue: fracText(l.value), rightValue: fracText(r.value), holds: equals(l.value, r.value) };
}

/** The first x from 2 up where the two expressions differ (2 if they never do), so a wrong one shows the difference. */
function compareAt<A extends string, B extends string>(a: A, p: Term[], b: B, q: Term[]): Comparison<A, B> {
  let x = 2;
  while (x < 12 && equals(putIn(p, frac(x)).value, putIn(q, frac(x)).value)) x++;
  if (x === 12) x = 2;
  const wp = worked(p, frac(x));
  const wq = worked(q, frac(x));
  return {
    x: `${x}`,
    [a]: wp.text,
    [`${a}Value`]: fracText(wp.value),
    [b]: wq.text,
    [`${b}Value`]: fracText(wq.value),
    holds: equals(wp.value, wq.value),
  } as Comparison<A, B>;
}

/** An expression answer as terms, leaving out a 0 (as answerText does). */
function answerTerms(a: { x: Fraction; c: Fraction }): Term[] {
  const terms: Term[] = [];
  if (a.x.num !== 0) terms.push({ coef: a.x, hasX: true });
  if (a.c.num !== 0 || terms.length === 0) terms.push({ coef: a.c, hasX: false });
  return terms;
}

/** "3x + 2x = 5x" or "4 − 1 = 3" (whole-number coefficients, as in the questions). */
function sumLine(terms: Term[], hasX: boolean): string {
  const same = terms.filter((t) => t.hasX === hasX);
  const total = same.reduce((s, t) => s + t.coef.num / t.coef.den, 0);
  const totalText = total === 0 ? "0" : formatSide([[total, hasX]]);
  const text = formatSide(same.map((t) => [t.coef.num / t.coef.den, hasX] as [number, boolean]));
  return same.length > 1 ? `${text} = ${totalText}` : text;
}

function integerReceipt(inst: Instance, v: Fraction): AnswerReceipt | null {
  const { a, b, op } = inst.params;
  if (a === undefined || b === undefined || op === undefined) return null;
  const x = frac(a);
  const y = frac(op === 1 ? -b : b);
  const back = sub(v, y);
  return {
    kind: "integer",
    expr: `${br(x)} + ${br(y)}`,
    value: fracText(v),
    rule: Math.sign(x.num) === Math.sign(y.num) ? "same-signs" : "different-signs",
    check: `${br(v)} ${MINUS} ${br(y)} = ${fracText(back)}`,
    back: fracText(back),
    start: fracText(x),
    holds: equals(back, x),
  };
}

/** The receipt for a final answer (the child's, or the correct one). Null if this kind of question has none. */
export function answerReceipt(inst: Instance, answer: Answer): AnswerReceipt | null {
  if (isExpr(inst.answer)) {
    const q = parseExpression(inst.text);
    if (!q.ok || !isExpr(answer)) return null;
    const right = equals(answer.x, q.side.expr.xCoef) && equals(answer.c, q.side.expr.constant);
    if (right) {
      return { kind: "collect", xTerms: sumLine(q.side.terms, true), numbers: sumLine(q.side.terms, false), result: answerText(answer), holds: true };
    }
    return { kind: "compare", ...compareAt("question", q.side.terms, "answer", answerTerms(answer)) };
  }
  if (isExpr(answer)) return null;
  const eq = parseEquation(inst.text);
  if (eq.ok) return { kind: "substitute", ...substitution(eq.equation, answer) };
  return integerReceipt(inst, answer);
}

function arithmetic(text: string): Fraction | null {
  try {
    return evaluateArithmetic(normaliseInput(text));
  } catch {
    return null;
  }
}

/**
 * The receipt for a typed Teach line, against the (correct) line above it: the same solution (equations) or the
 * same value (expressions and sums). Null if the typed line cannot be read.
 */
export function lineReceipt(inst: Instance, lineAbove: string, typed: string): LineReceipt | null {
  if (isExpr(inst.answer)) {
    const above = parseExpression(lineAbove);
    const line = parseExpression(typed);
    if (!above.ok || !line.ok) return null;
    const same = equals(above.side.expr.xCoef, line.side.expr.xCoef) && equals(above.side.expr.constant, line.side.expr.constant);
    return { kind: "line", sameValue: same, value: null, check: compareAt("above", above.side.terms, "line", line.side.terms) };
  }
  const above = parseEquation(lineAbove);
  if (above.ok) {
    const line = parseEquation(typed);
    if (!line.ok) return null;
    const r = root(line.equation);
    if (typeof r !== "object") return { kind: "line", sameSolution: false, solution: null, check: null };
    const check = substitution(above.equation, r);
    return { kind: "line", sameSolution: check.holds, solution: `x = ${fracText(r)}`, check };
  }
  const p = arithmetic(lineAbove);
  const q = arithmetic(typed);
  if (!p || !q) return null;
  const same = equals(p, q);
  return { kind: "line", sameValue: same, value: same ? fracText(q) : null, check: null };
}

/** lineReceipt against the line just above the mistake's first wrong line (a correct line of the working). */
export function teachLineReceipt(inst: Instance, mistake: Mistake, typed: string): LineReceipt | null {
  const out = mistake.apply(inst);
  return lineReceipt(inst, out.trace[out.firstWrongLine - 2].text, typed);
}
