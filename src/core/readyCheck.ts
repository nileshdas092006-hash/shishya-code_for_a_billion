import { frac } from "./fraction";
import { createRng, randInt, type Rng } from "./rng";
import { MINUS } from "./skills/helpers";
import type { Instance } from "./types";

// The Ready check: 6 quick whole-number questions a child answers once, before the first skill (2 addition,
// 2 subtraction, 2 multiplication, sizes like Class 5–6). It is NOT a skill of the mastery chain: it only tells the
// teacher who may need number basics first (outside Shishya), and it never blocks a child.
// Each question is fully determined by its own seed (the operation is seed mod 3), so it can always be re-created.

export const READY_CHECK_ID = "num.ready-check";
export const READY_CHECK_VERSION = "1.0.0";
export type ReadyOp = "add" | "sub" | "mul";
const OPS: readonly ReadyOp[] = ["add", "sub", "mul"];
export const READY_CHECK_PLAN: readonly ReadyOp[] = ["add", "add", "sub", "sub", "mul", "mul"];
/** 5 or 6 right: nothing changes. 4 or fewer: the teacher sees the child under "Needs number basics first". */
export const READY_CHECK_PASS = 5;
const MAX_SEED = 2 ** 31 - 1;

export const readyCheckPassed = (correct: number) => correct >= READY_CHECK_PASS;

/** The operation a seed's question uses. */
export const readyOpOf = (seed: number): ReadyOp => OPS[((seed % 3) + 3) % 3];

/** The question for a seed: a + b (3–4 digits + 3 digits), a − b (4 digits − 3 digits) or a × b (2 digits × 2 digits). */
export function readyQuestion(seed: number): Instance {
  const rng = createRng(seed); // a question depends on nothing but its own seed
  const op = readyOpOf(seed);
  let a: number;
  let b: number;
  if (op === "add") {
    a = randInt(rng, 100, 9999);
    b = randInt(rng, 100, 999);
  } else if (op === "sub") {
    a = randInt(rng, 1000, 9999);
    b = randInt(rng, 100, 999);
  } else {
    a = randInt(rng, 12, 99);
    b = randInt(rng, 11, 99);
  }
  const value = op === "add" ? a + b : op === "sub" ? a - b : a * b;
  const sign = op === "add" ? "+" : op === "sub" ? MINUS : "×";
  return { skillId: READY_CHECK_ID, version: READY_CHECK_VERSION, seed, params: { a, b }, text: `${a} ${sign} ${b}`, answer: frac(value) };
}

/** The 6 seeds of one Ready check, in the plan's order, drawn from rng (all different questions). */
export function readyCheckSeeds(rng: Rng): number[] {
  const seeds: number[] = [];
  const texts = new Set<string>();
  for (const op of READY_CHECK_PLAN) {
    for (;;) {
      const base = randInt(rng, 1, Math.floor(MAX_SEED / 3) - 1) * 3;
      const seed = base + OPS.indexOf(op);
      const text = readyQuestion(seed).text;
      if (texts.has(text)) continue;
      texts.add(text);
      seeds.push(seed);
      break;
    }
  }
  return seeds;
}

