import { add, div, equals, frac, sub, type Fraction } from "./fraction";
import { normaliseInput } from "./normalise";

// Parses a typed linear equation in one variable x, such as "4x − 2x − 3 = 7".
// No brackets yet. Never throws: a line it cannot read gives a child-friendly reason instead,
// in English (error) and as a message key for translation (errorKey, errorParams; see src/i18n).

export type Term = { coef: Fraction; hasX: boolean };
/** A simplified linear expression: xCoef·x + constant. */
export type Linear = { xCoef: Fraction; constant: Fraction };
export type Side = { terms: Term[]; expr: Linear };
export type Equation = { left: Side; right: Side };

export type MessageParams = Record<string, string | number>;
export type ParseResult =
  | { ok: true; equation: Equation }
  | { ok: false; error: string; errorKey: ParseErrorKey; errorParams?: MessageParams };

/** English text for each parse error; src/i18n/en.ts reuses these. */
export const PARSE_MESSAGES = {
  "parse.empty": "Type a line first.",
  "parse.noEquals": "An equation needs an equals sign (=).",
  "parse.manyEquals": "Use only one equals sign (=).",
  "parse.sideMissing": "Something is missing on one side of the = sign.",
  "parse.needSign": "Put a + or − sign between two terms.",
  "parse.signNeedsTerm": "A + or − sign needs a number or x after it.",
  "parse.decimals": "Use whole numbers only, without decimals.",
  "parse.brackets": "Brackets are not needed here. Write the line without them.",
  "parse.fractions": "Use whole numbers only, without fractions.",
  "parse.unreadable": 'I cannot read "{ch}". Use only numbers, x, +, − and =.',
  "parse.tooBig": "That number is too big. Check the line again.",
  "parse.generic": "I could not read that line. Check it and try again.",
  "parse.extraEquals": "Write just the expression here, without an equals sign (=).",
  "parse.arith": "Use only whole numbers, brackets, + and −.",
} as const;
export type ParseErrorKey = keyof typeof PARSE_MESSAGES;

/** Fills {name} placeholders. */
export const fill = (text: string, params?: MessageParams) =>
  text.replace(/\{(\w+)\}/g, (m, name: string) => (params && name in params ? String(params[name]) : m));

const MAX_DIGITS = 6;

// (No constructor parameter properties: Node's type stripping, used by scripts/, does not support them.)
class ParseError extends Error {
  key: ParseErrorKey;
  params?: MessageParams;
  constructor(key: ParseErrorKey, params?: MessageParams) {
    super(fill(PARSE_MESSAGES[key], params));
    this.key = key;
    this.params = params;
  }
}

const failure = (key: ParseErrorKey, params?: MessageParams): ParseResult => ({
  ok: false,
  error: fill(PARSE_MESSAGES[key], params),
  errorKey: key,
  ...(params ? { errorParams: params } : {}),
});

function simplify(terms: Term[]): Linear {
  let xCoef = frac(0);
  let constant = frac(0);
  for (const t of terms) {
    if (t.hasX) xCoef = add(xCoef, t.coef);
    else constant = add(constant, t.coef);
  }
  return { xCoef, constant };
}

function unreadable(ch: string): ParseError {
  if (ch === "." || ch === ",") return new ParseError("parse.decimals");
  if (ch === "(" || ch === ")") return new ParseError("parse.brackets");
  if (ch === "/") return new ParseError("parse.fractions");
  return new ParseError("parse.unreadable", { ch });
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
      if (/[0-9x]/.test(ch)) throw new ParseError("parse.needSign");
      throw unreadable(ch);
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
      if (i >= text.length) throw new ParseError("parse.signNeedsTerm");
      throw unreadable(text[i]);
    }
    if (digits.length > MAX_DIGITS) throw new ParseError("parse.tooBig");

    terms.push({ coef: frac(sign * (digits ? Number(digits) : 1)), hasX });
  }

  if (terms.length === 0) throw new ParseError("parse.sideMissing");
  return { terms, expr: simplify(terms) };
}

export function parseEquation(text: string): ParseResult {
  try {
    const clean = normaliseInput(text)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return failure("parse.empty");
    const parts = clean.split("=");
    if (parts.length === 1) return failure("parse.noEquals");
    if (parts.length > 2) return failure("parse.manyEquals");
    return { ok: true, equation: { left: parseSide(parts[0]), right: parseSide(parts[1]) } };
  } catch (e) {
    if (e instanceof ParseError) return failure(e.key, e.params);
    return failure("parse.generic");
  }
}

export type ExpressionResult =
  | { ok: true; side: Side }
  | { ok: false; error: string; errorKey: ParseErrorKey; errorParams?: MessageParams };

/** Parses an expression in x without "=", such as "3x + 5 − x + 2". Never throws. */
export function parseExpression(text: string): ExpressionResult {
  const fail = (r: ParseResult): ExpressionResult =>
    r.ok ? { ok: false, error: PARSE_MESSAGES["parse.generic"], errorKey: "parse.generic" } : r;
  try {
    const clean = normaliseInput(text)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return fail(failure("parse.empty"));
    if (clean.includes("=")) return fail(failure("parse.extraEquals"));
    return { ok: true, side: parseSide(clean) };
  } catch (e) {
    if (e instanceof ParseError) return fail(failure(e.key, e.params));
    return fail(failure("parse.generic"));
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
