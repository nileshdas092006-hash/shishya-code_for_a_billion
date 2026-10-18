import { add, div, equals, frac, sub, type Fraction } from "./fraction";

// Parses a typed linear equation in one variable x, such as "4x − 2x − 3 = 7".
// No brackets yet. Never throws: a line it cannot read gives a child-friendly reason instead.

export type Term = { coef: Fraction; hasX: boolean };
/** A simplified linear expression: xCoef·x + constant. */
export type Linear = { xCoef: Fraction; constant: Fraction };
export type Side = { terms: Term[]; expr: Linear };
export type Equation = { left: Side; right: Side };

export type ParseResult = { ok: true; equation: Equation } | { ok: false; error: string };

const MAX_DIGITS = 6;

class ParseError extends Error {}

function simplify(terms: Term[]): Linear {
  let xCoef = frac(0);
  let constant = frac(0);
  for (const t of terms) {
    if (t.hasX) xCoef = add(xCoef, t.coef);
    else constant = add(constant, t.coef);
  }
  return { xCoef, constant };
}

function unreadable(ch: string): string {
  if (ch === "." || ch === ",") return "Use whole numbers only, without decimals.";
  if (ch === "(" || ch === ")") return "Brackets are not needed here. Write the line without them.";
  if (ch === "/") return "Use whole numbers only, without fractions.";
  return `I cannot read "${ch}". Use only numbers, x, +, − and =.`;
}

function parseSide(text: string): Side {
  const terms: Term[] = [];
  let i = 0;
  const skipSpaces = () => {
    while (i < text.length && text[i] === " ") i++;
  };

  for (;;) {
    skipSpaces();
    if (i >= text.length) break;

    let sign = 1;
    let sawSign = false;
    while (i < text.length && (text[i] === "+" || text[i] === "-")) {
      if (text[i] === "-") sign = -sign;
      sawSign = true;
      i++;
      skipSpaces();
    }
    if (terms.length > 0 && !sawSign) {
      const ch = text[i];
      if (/[0-9x]/.test(ch)) throw new ParseError("Put a + or − sign between two terms.");
      throw new ParseError(unreadable(ch));
    }

    let digits = "";
    while (i < text.length && /[0-9]/.test(text[i])) digits += text[i++];
    skipSpaces();
    let hasX = false;
    if (text[i] === "x") {
      hasX = true;
      i++;
    }

    if (!digits && !hasX) {
      if (i >= text.length) throw new ParseError("A + or − sign needs a number or x after it.");
      throw new ParseError(unreadable(text[i]));
    }
    if (digits.length > MAX_DIGITS) throw new ParseError("That number is too big. Check the line again.");

    terms.push({ coef: frac(sign * (digits ? Number(digits) : 1)), hasX });
  }

  if (terms.length === 0) throw new ParseError("Something is missing on one side of the = sign.");
  return { terms, expr: simplify(terms) };
}

export function parseEquation(text: string): ParseResult {
  try {
    const clean = String(text ?? "")
      .toLowerCase()
      .replace(/[−–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return { ok: false, error: "Type a line first." };
    const parts = clean.split("=");
    if (parts.length === 1) return { ok: false, error: "An equation needs an equals sign (=)." };
    if (parts.length > 2) return { ok: false, error: "Use only one equals sign (=)." };
    return { ok: true, equation: { left: parseSide(parts[0]), right: parseSide(parts[1]) } };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message };
    return { ok: false, error: "I could not read that line. Check it and try again." };
  }
}

/** The single solution, or "none" (no x works) / "all" (every x works). */
export function root(eq: Equation): Fraction | "none" | "all" {
  const xCoef = sub(eq.left.expr.xCoef, eq.right.expr.xCoef);
  const constant = sub(eq.right.expr.constant, eq.left.expr.constant);
  if (xCoef.num !== 0) return div(constant, xCoef);
  return constant.num === 0 ? "all" : "none";
}

/** True only if both equations have exactly one solution and it is the same. */
export function equivalent(e1: Equation, e2: Equation): boolean {
  const r1 = root(e1);
  const r2 = root(e2);
  return typeof r1 === "object" && typeof r2 === "object" && equals(r1, r2);
}
