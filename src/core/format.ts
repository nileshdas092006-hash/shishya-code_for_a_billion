import type { Fraction } from "./fraction";

// How equations are printed everywhere ("4x − 3 = 2x + 7"): the real minus sign, never "+ −",
// coefficient 1 as "x" and −1 as "−x". Shared by the skills and by mined mistakes.

export const MINUS = "−"; // U+2212

/** One term of an expression: a coefficient, with or without x. */
export type Term = [coef: number, hasX: boolean];

function termText([coef, hasX]: Term, leading: boolean): string {
  const size = Math.abs(coef);
  const body = hasX ? (size === 1 ? "x" : `${size}x`) : `${size}`;
  if (leading) return coef < 0 ? `${MINUS}${body}` : body;
  return coef < 0 ? ` ${MINUS} ${body}` : ` + ${body}`;
}

export const formatSide = (terms: Term[]) => terms.map((t, i) => termText(t, i === 0)).join("");
export const formatEquation = (left: Term[], right: Term[]) => `${formatSide(left)} = ${formatSide(right)}`;

export function fracText(f: Fraction): string {
  const sign = f.num < 0 ? MINUS : "";
  const size = Math.abs(f.num);
  return f.den === 1 ? `${sign}${size}` : `${sign}${size}/${f.den}`;
}
