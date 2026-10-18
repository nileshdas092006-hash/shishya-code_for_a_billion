import { frac, type Fraction } from "./fraction";

// Reads a child's typed final answer: "5", "−3", "5/3", or "x = 5". Never throws.

/** English text for each answer error; src/i18n/en.ts reuses these. */
export const ANSWER_MESSAGES = {
  "answer.format": "Type your answer as a number, like 5, −3 or 5/3.",
  "answer.zeroDen": "The bottom number of a fraction cannot be 0.",
} as const;
export type AnswerErrorKey = keyof typeof ANSWER_MESSAGES;

export type AnswerResult = { ok: true; value: Fraction } | { ok: false; error: string; errorKey: AnswerErrorKey };

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
