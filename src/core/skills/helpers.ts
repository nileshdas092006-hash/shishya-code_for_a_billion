import { sameAnswer } from "../answer";
import { randInt, type Rng } from "../rng";
import { applies, type Instance, type Mistake, type Trace } from "../types";

// Small helpers shared by the skill files.

export const MINUS = "−"; // U+2212, the printed minus sign

export const toTrace = (lines: string[]): Trace => lines.map((text) => ({ text }));

/** A whole number in [−max, max], never 0. */
export function nonZero(rng: Rng, max: number): number {
  const v = randInt(rng, -max, max - 1);
  return v >= 0 ? v + 1 : v;
}

/** A whole number printed with the real minus sign: −4. */
export const num = (n: number) => (n < 0 ? `${MINUS}${-n}` : `${n}`);

/**
 * Generator rule shared by every skill: at least one mistake applies, and the correct answer and the answers of
 * the mistakes that apply are all different (so a wrong answer always points to at most one mistake).
 */
export function mistakesAreSound(inst: Instance, mistakes: Mistake[]): boolean {
  const list = mistakes.filter((m) => applies(m, inst));
  if (list.length === 0) return false;
  const answers = [inst.answer, ...list.map((m) => m.apply(inst).answer)];
  return answers.every((p, i) => answers.every((q, j) => i === j || !sameAnswer(p, q)));
}
