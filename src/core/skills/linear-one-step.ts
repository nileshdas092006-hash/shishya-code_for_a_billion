import { parseEquation } from "../equation";
import { formatEquation, fracText } from "../format";
import { frac, type Fraction } from "../fraction";
import { checkEquationLine } from "../lineCheck";
import { randInt, type Rng } from "../rng";
import type { ApplyItem, Instance, LineCheck, Mistake, SkillSpec, Trace } from "../types";
import { mistakesAreSound, nonZero, toTrace } from "./helpers";

// Skill 3: one-step equations, solved by doing the opposite operation on both sides.
// params: a, b, d for a·x + b = d, in one of two forms:
//   x + b = d   (a = 1, b ≠ 0):  x + 7 = 3  →  x + 7 − 7 = 3 − 7  →  x = −4
//   a·x = d     (b = 0):         4x = −12   →  x = −3

const SKILL_ID = "alg.linear.one-step";
const VERSION = "1.0.0";
const MAX_TRIES = 1000;

type P = { a: number; b: number; d: number };
const P = (inst: Instance): P => ({ a: inst.params.a, b: inst.params.b, d: inst.params.d });
const isAdd = (p: P) => p.a === 1;

const questionText = (p: P) => (isAdd(p) ? formatEquation([[1, true], [p.b, false]], [[p.d, false]]) : formatEquation([[p.a, true]], [[p.d, false]]));
const answerOf = (p: P): Fraction => frac(p.d - p.b, p.a);
const xEquals = (v: Fraction) => `x = ${fracText(v)}`;
/** x + b − b = d − b: the opposite operation, on both sides. */
const undoLine = (p: P) => formatEquation([[1, true], [p.b, false], [-p.b, false]], [[p.d, false], [-p.b, false]]);

function correctLines(p: P): string[] {
  return isAdd(p) ? [questionText(p), undoLine(p), xEquals(answerOf(p))] : [questionText(p), xEquals(answerOf(p))];
}

export function makeOneStepInstance(p: P, seed: number): Instance {
  return { skillId: SKILL_ID, version: VERSION, seed, params: { a: p.a, b: p.b, d: p.d }, text: questionText(p), answer: answerOf(p) };
}

function solve(inst: Instance): { trace: Trace; answer: Fraction } {
  const p = P(inst);
  return { trace: toTrace(correctLines(p)), answer: answerOf(p) };
}

function checkLine(inst: Instance, line: number, typed: string): LineCheck {
  const q = parseEquation(inst.text);
  if (!q.ok) throw new Error(`Question does not parse: ${inst.text}`);
  const correct = correctLines(P(inst));
  return checkEquationLine(q.equation, correct[line - 2] ?? correct[0], typed, line >= correct.length);
}

// ---------- mistakes ----------

const sameOperation: Mistake = {
  id: "same-operation",
  label: "Did the same operation instead of the opposite one (added instead of subtracting, multiplied instead of dividing)",
  childLabel:
    "To remove a number, do the opposite operation on both sides: subtract to remove an added number, add to remove a subtracted number, and divide to remove a multiplying number.",
  stepType: "operation",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    if (isAdd(p)) {
      const v = frac(p.d + p.b);
      return { trace: toTrace([questionText(p), formatEquation([[1, true]], [[p.d, false], [p.b, false]]), xEquals(v)]), answer: v, firstWrongLine: 2 };
    }
    const v = frac(p.d * p.a);
    return { trace: toTrace([questionText(p), xEquals(v)]), answer: v, firstWrongLine: 2 };
  },
};

const dividedWrongWay: Mistake = {
  id: "divided-wrong-way",
  label: "Divided the wrong way round: x = a ÷ d instead of d ÷ a",
  childLabel: "Divide both sides by the number in front of x. In 4x = −12, x = −12 ÷ 4: the number in front of x goes at the bottom.",
  stepType: "divide",
  origin: "authored",
  appliesTo: (inst) => inst.params.a !== 1,
  apply(inst) {
    const p = P(inst);
    const v = frac(p.a, p.d);
    return { trace: toTrace([questionText(p), xEquals(v)]), answer: v, firstWrongLine: 2 };
  },
};

const signError: Mistake = {
  id: "sign-error",
  label: "Got the sign of the answer wrong",
  childLabel: "Check the sign of your answer: put it back into the question, and both sides must come out equal.",
  stepType: "sign",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    const v = frac(-(p.d - p.b), p.a);
    const lines = isAdd(p) ? [questionText(p), undoLine(p), xEquals(v)] : [questionText(p), xEquals(v)];
    return { trace: toTrace(lines), answer: v, firstWrongLine: lines.length };
  },
};

const mistakes: Mistake[] = [sameOperation, dividedWrongWay, signError];

// ---------- questions ----------

/** Half x ± b = d (b in −9…9, d in −12…12: every line fits a phone), half a·x = d (|a| ≥ 2); a whole-number answer from −12 to 12, never 0. */
function generate(rng: Rng): Instance {
  for (let i = 0; i < MAX_TRIES; i++) {
    const x = nonZero(rng, 12);
    let p: P;
    if (randInt(rng, 0, 1) === 0) {
      const b = nonZero(rng, 9);
      p = { a: 1, b, d: x + b };
      if (p.d === 0 || Math.abs(p.d) > 12) continue;
    } else {
      const a = nonZero(rng, 9);
      if (Math.abs(a) < 2) continue;
      p = { a, b: 0, d: a * x };
    }
    const inst = makeOneStepInstance(p, rng.seed);
    if (mistakesAreSound(inst, mistakes)) return inst;
  }
  throw new Error(`${SKILL_ID}: no valid question after ${MAX_TRIES} tries (seed ${rng.seed})`);
}

export const linearOneStep: SkillSpec = {
  id: SKILL_ID,
  version: VERSION,
  statement: "Solve one-step equations such as x + 7 = 3, x − 5 = −2 and 4x = −12.",
  prerequisites: ["alg.like-terms"],
  answerKind: "number",
  generate,
  solve,
  checkLine,
  mistakes,
  // The worked examples use y, so a hint never gives away "x = …".
  hintLadder: [
    "Look at what is done to x: is a number added to it, subtracted from it, or multiplying it?",
    "Undo it with the opposite operation, and do the same operation on both sides so they stay equal.",
    "If a number is added, subtract it from both sides. If a number is subtracted, add it to both sides. If x is multiplied by a number, divide both sides by that number.",
    "Examples with y: y + 15 = 4 gives y + 15 − 15 = 4 − 15, so y = −11. And 6y = 42 gives y = 42 ÷ 6 = 7.",
  ],
  teachRule: { traces: 3, distinctMistakesMin: 2, triesMax: 2 },
  proofRule: { solve: 3, apply: 1, allCorrect: true },
};

// ---------- word problems: marbles, money, sharing ----------

export function linearOneStepApply(rng: Rng): ApplyItem {
  const kind = randInt(rng, 0, 2);
  if (kind === 0) {
    const b = randInt(rng, 2, 15);
    const x = randInt(rng, 3, 20);
    return {
      instance: makeOneStepInstance({ a: 1, b, d: x + b }, rng.seed),
      text: `Meena had some marbles. Her friend gave her ${b} more, and now she has ${x + b}. How many marbles did Meena have at first?`,
      textHi: `मीना के पास कुछ कंचे थे। उसकी सहेली ने उसे ${b} कंचे और दिए, और अब उसके पास ${x + b} कंचे हैं। मीना के पास पहले कितने कंचे थे?`,
    };
  }
  if (kind === 1) {
    const spent = randInt(rng, 10, 90);
    const left = randInt(rng, 5, 60);
    return {
      instance: makeOneStepInstance({ a: 1, b: -spent, d: left }, rng.seed),
      text: `Arjun had some money. After spending ₹${spent} on a book, he has ₹${left} left. How much money did he have at first, in rupees?`,
      textHi: `अर्जुन के पास कुछ पैसे थे। ₹${spent} की किताब खरीदने के बाद उसके पास ₹${left} बचे हैं। उसके पास पहले कितने रुपये थे?`,
    };
  }
  const friends = randInt(rng, 2, 9);
  const each = randInt(rng, 10, 90);
  return {
    instance: makeOneStepInstance({ a: friends, b: 0, d: friends * each }, rng.seed),
    text: `${friends} friends share a restaurant bill of ₹${friends * each} equally. How much does each friend pay, in rupees?`,
    textHi: `${friends} दोस्त ₹${friends * each} के बिल को बराबर-बराबर बाँटते हैं। हर दोस्त कितने रुपये देगा?`,
  };
}

