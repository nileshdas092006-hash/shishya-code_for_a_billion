import { formatSide, type Term } from "../format";
import { frac } from "../fraction";
import { checkExpressionLine } from "../lineCheck";
import { randInt, type Rng } from "../rng";
import type { ApplyItem, ExprAnswer, Instance, LineCheck, Mistake, SkillSpec, Trace } from "../types";
import { mistakesAreSound, nonZero, toTrace } from "./helpers";

// Skill 2: combining like terms, e.g. 3x + 5 − x + 2 = 2x + 7. params: a, b, c, d for a·x + b + c·x + d.
// The answer is an EXPRESSION (2x + 7), not a number. The working:
//   group like terms (each term keeps its sign):  3x − x + 5 + 2
//   add them:                                     2x + 7

const SKILL_ID = "alg.like-terms";
const VERSION = "1.0.0";
const MAX_TRIES = 1000;

type P = { a: number; b: number; c: number; d: number };
const P = (inst: Instance): P => ({ a: inst.params.a, b: inst.params.b, c: inst.params.c, d: inst.params.d });

const expr = (x: number, c: number): ExprAnswer => ({ kind: "expr", x: frac(x), c: frac(c) });
/** The simplest form: one x-term and one number, leaving out a 0. */
const simplest = (x: number, k: number) => {
  const terms: Term[] = [];
  if (x !== 0) terms.push([x, true]);
  if (k !== 0 || terms.length === 0) terms.push([k, false]);
  return formatSide(terms);
};
const questionText = ({ a, b, c, d }: P) => formatSide([[a, true], [b, false], [c, true], [d, false]]);
const grouped = ({ a, b, c, d }: P) => formatSide([[a, true], [c, true], [b, false], [d, false]]);

function correctLines(p: P): string[] {
  return [questionText(p), grouped(p), simplest(p.a + p.c, p.b + p.d)];
}

export function makeLikeTermsInstance(p: P, seed: number): Instance {
  return { skillId: SKILL_ID, version: VERSION, seed, params: { ...p }, text: questionText(p), answer: expr(p.a + p.c, p.b + p.d) };
}

function solve(inst: Instance): { trace: Trace; answer: ExprAnswer } {
  const p = P(inst);
  return { trace: toTrace(correctLines(p)), answer: expr(p.a + p.c, p.b + p.d) };
}

function checkLine(inst: Instance, line: number, typed: string): LineCheck {
  const p = P(inst);
  const correct = correctLines(p);
  const question = { xCoef: frac(p.a + p.c), constant: frac(p.b + p.d) };
  return checkExpressionLine(question, correct[line - 2] ?? correct[0], typed, line >= correct.length);
}

// ---------- mistakes ----------

const addedAllTogether: Mistake = {
  id: "added-all-together",
  label: "Added x-terms and numbers together: (a + b + c + d)x",
  childLabel: "x-terms and numbers are unlike terms, so they cannot be added together. Add the x-terms to each other, and the numbers to each other.",
  stepType: "simplify",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    const sum = p.a + p.b + p.c + p.d;
    return { trace: toTrace([questionText(p), grouped(p), simplest(sum, 0)]), answer: expr(sum, 0), firstWrongLine: 3 };
  },
};

/** The first negative term, in the order it is written: a·x, b, c·x, d. */
const firstNegative = (p: P) => (["a", "b", "c", "d"] as const).find((k) => p[k] < 0);

const droppedSign: Mistake = {
  id: "dropped-sign",
  label: "Dropped the minus sign of a term",
  childLabel: "A term's sign belongs to it. When you put like terms together, keep the minus sign with its term.",
  stepType: "sign",
  origin: "authored",
  appliesTo: (inst) => firstNegative(P(inst)) !== undefined,
  apply(inst) {
    const p = P(inst);
    const k = firstNegative(p)!;
    const q = { ...p, [k]: -p[k] };
    return { trace: toTrace([questionText(p), grouped(q), simplest(q.a + q.c, q.b + q.d)]), answer: expr(q.a + q.c, q.b + q.d), firstWrongLine: 2 };
  },
};

const xAs0x: Mistake = {
  id: "x-as-0x",
  label: "Treated x (or −x) as 0x",
  childLabel: "x means 1x, and −x means −1x. Count it when you add the x-terms.",
  stepType: "simplify",
  origin: "authored",
  appliesTo: (inst) => Math.abs(inst.params.a) === 1 || Math.abs(inst.params.c) === 1,
  apply(inst) {
    const p = P(inst);
    const a = Math.abs(p.a) === 1 ? 0 : p.a;
    const c = Math.abs(p.c) === 1 ? 0 : p.c;
    const line2 = formatSide([[a, true], [c, true], [p.b, false], [p.d, false]]);
    return { trace: toTrace([questionText(p), line2, simplest(a + c, p.b + p.d)]), answer: expr(a + c, p.b + p.d), firstWrongLine: 2 };
  },
};

const mistakes: Mistake[] = [addedAllTogether, droppedSign, xAs0x];

// ---------- questions ----------

/** x-terms −9…9 (often x or −x), numbers −12…12, none 0; the answer keeps an x-term and a number. */
function generate(rng: Rng): Instance {
  for (let i = 0; i < MAX_TRIES; i++) {
    const a = nonZero(rng, 9);
    const c = rng.next() < 0.4 ? (rng.next() < 0.5 ? 1 : -1) : nonZero(rng, 9);
    const b = nonZero(rng, 12);
    const d = nonZero(rng, 12);
    if (a + c === 0 || b + d === 0 || a + b + c + d === 0) continue;
    const inst = makeLikeTermsInstance({ a, b, c, d }, rng.seed);
    if (mistakesAreSound(inst, mistakes)) return inst;
  }
  throw new Error(`${SKILL_ID}: no valid question after ${MAX_TRIES} tries (seed ${rng.seed})`);
}

export const likeTerms: SkillSpec = {
  id: SKILL_ID,
  version: VERSION,
  statement: "Simplify expressions by combining like terms, such as 3x + 5 − x + 2 = 2x + 7.",
  prerequisites: ["alg.integers.ops"],
  answerKind: "expression",
  generate,
  solve,
  checkLine,
  mistakes,
  // The worked example uses y, so a hint never gives away an answer in x.
  hintLadder: [
    "Find the like terms: the terms with x are like terms, and the numbers are like terms.",
    "Put like terms next to each other. Each term keeps its own sign.",
    "Add the x-terms to each other and the numbers to each other. An x-term and a number are unlike terms, so they stay separate. x means 1x.",
    "An example with y: 5y + 9 − 2y + 3 = 5y − 2y + 9 + 3 = 3y + 12.",
  ],
  teachRule: { traces: 3, distinctMistakesMin: 2, triesMax: 2 },
  proofRule: { solve: 3, apply: 1, allCorrect: true },
};

// ---------- word problem: shopping ----------

export function likeTermsApply(rng: Rng): ApplyItem {
  const a = randInt(rng, 2, 9);
  const c = randInt(rng, 2, 9);
  const b = 5 * randInt(rng, 2, 10);
  const d = 5 * randInt(rng, 1, 8);
  return {
    instance: makeLikeTermsInstance({ a, b, c, d }, rng.seed),
    text: `Asha buys ${a} packets of biscuits at ₹x each and a bottle of water for ₹${b}. Her brother buys ${c} more packets at ₹x each and a pen for ₹${d}. Write the total cost in rupees as simply as possible.`,
    textHi: `आशा ₹x प्रति पैकेट की दर से बिस्किट के ${a} पैकेट और ₹${b} की पानी की बोतल खरीदती है। उसका भाई ₹x प्रति पैकेट की दर से ${c} पैकेट और ₹${d} का पेन खरीदता है। कुल खर्च (रुपयों में) को सबसे सरल रूप में लिखो।`,
  };
}
