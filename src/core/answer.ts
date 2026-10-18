import { frac, type Fraction } from "./fraction";

// Reads a child's typed final answer: "5", "−3", "5/3", or "x = 5". Never throws.

export type AnswerResult = { ok: true; value: Fraction } | { ok: false; error: string };

const FORMAT_HELP = "Type your answer as a number, like 5, −3 or 5/3.";

export function parseAnswer(text: string): AnswerResult {
  const clean = String(text ?? "")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .trim()
    .replace(/\s*([=/-])\s*/g, "$1") // spaces around signs are fine; "1 2" is not "12"
    .replace(/^x=/, "");
  const m = /^(-?)(\d{1,6})(?:\/(\d{1,6}))?$/.exec(clean);
  if (!m) return { ok: false, error: FORMAT_HELP };
  const num = Number(m[2]) * (m[1] ? -1 : 1);
  const den = m[3] === undefined ? 1 : Number(m[3]);
  if (den === 0) return { ok: false, error: "The bottom number of a fraction cannot be 0." };
  return { ok: true, value: frac(num, den) };
}
