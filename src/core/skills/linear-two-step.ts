import { parseEquation } from "../equation";
import { formatEquation, formatSide, fracText } from "../format";
import { frac, sub, type Fraction } from "../fraction";
import { checkEquationLine } from "../lineCheck";
import { randInt, type Rng } from "../rng";
import type { ApplyItem, Instance, LineCheck, Mistake, SkillSpec, Trace } from "../types";
import { mistakesAreSound, nonZero, num, toTrace } from "./helpers";

// Skill 4: two-step equations a·x + b = d, e.g. 5x − 3 = −8. params: a, b, d. The working:
//   remove the number next to the x-term (the opposite operation on both sides):  5x = −8 + 3
//   work out the right side:                                                      5x = −5
//   divide both sides by the number in front of x:                                x = −1

const SKILL_ID = "alg.linear.two-step";
const VERSION = "1.0.0";
const MAX_TRIES = 1000;

type P = { a: number; b: number; d: number };
const P = (inst: Instance): P => ({ a: inst.params.a, b: inst.params.b, d: inst.params.d });

const questionText = (p: P) => formatEquation([[p.a, true], [p.b, false]], [[p.d, false]]);
const answerOf = (p: P): Fraction => frac(p.d - p.b, p.a);
const xEquals = (v: Fraction) => `x = ${fracText(v)}`;

function correctLines(p: P): string[] {
  return [
    questionText(p),
    formatEquation([[p.a, true]], [[p.d, false], [-p.b, false]]),
    formatEquation([[p.a, true]], [[p.d - p.b, false]]),
    xEquals(answerOf(p)),
  ];
}

export function makeTwoStepInstance(p: P, seed: number): Instance {
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

const dividedFirst: Mistake = {
  id: "divided-first",
  label: "Divided before removing the constant (divided only d by a): x = d ÷ a − b",
  childLabel:
    "First remove the number next to the x-term by doing the opposite operation on both sides. Only then divide both sides by the number in front of x.",
  stepType: "divide",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    const right = frac(p.d, p.a);
    const v = sub(right, frac(p.b));
    const line2 = `${formatSide([[1, true], [p.b, false]])} = ${fracText(right)}`;
    return { trace: toTrace([questionText(p), line2, xEquals(v)]), answer: v, firstWrongLine: 2 };
  },
};

const keptConstSign: Mistake = {
  id: "kept-const-sign",
  label: "Took the constant across without the opposite operation: a·x = d + b",
  childLabel:
    "To remove a number from one side, do the opposite operation on both sides. To remove − 3, add 3 to both sides. To remove + 3, subtract 3 from both sides.",
  stepType: "move-const",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    const v = frac(p.d + p.b, p.a);
    const lines = [
      questionText(p),
      formatEquation([[p.a, true]], [[p.d, false], [p.b, false]]),
      formatEquation([[p.a, true]], [[p.d + p.b, false]]),
      xEquals(v),
    ];
    return { trace: toTrace(lines), answer: v, firstWrongLine: 2 };
  },
};

const forgotToDivide: Mistake = {
  id: "forgot-to-divide",
  label: "Reached a·x = d − b, then wrote x = d − b without dividing",
  childLabel: "This line still tells you what a number times x is. To find x itself, divide both sides by the number in front of x.",
  stepType: "divide",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    const v = frac(p.d - p.b);
    return { trace: toTrace([...correctLines(p).slice(0, 3), `x = ${num(p.d - p.b)}`]), answer: v, firstWrongLine: 4 };
  },
};

const mistakes: Mistake[] = [dividedFirst, keptConstSign, forgotToDivide];

// ---------- questions ----------

/** a in −9…9 with |a| ≥ 2, b in −12…12 (not 0), a whole-number answer −12…12 (not 0); all answers differ. */
function generate(rng: Rng): Instance {
  for (let i = 0; i < MAX_TRIES; i++) {
    const a = nonZero(rng, 9);
    const b = nonZero(rng, 12);
    const x = nonZero(rng, 12);
    if (Math.abs(a) < 2) continue;
    const inst = makeTwoStepInstance({ a, b, d: a * x + b }, rng.seed);
    if (mistakesAreSound(inst, mistakes)) return inst;
  }
  throw new Error(`${SKILL_ID}: no valid question after ${MAX_TRIES} tries (seed ${rng.seed})`);
}

export const linearTwoStep: SkillSpec = {
  id: SKILL_ID,
  version: VERSION,
  statement: "Solve two-step equations such as 5x − 3 = −8.",
  prerequisites: ["alg.linear.one-step"],
  answerKind: "number",
  generate,
  solve,
  checkLine,
  mistakes,
  // The worked example uses y, so a hint never gives away "x = …".
  hintLadder: [
    "There are two things done to x: it is multiplied by a number, and then a number is added or subtracted.",
    "Undo them in the opposite order, and do the same operation on both sides each time.",
    "First add or subtract on both sides to remove the number next to the x-term. Then divide both sides by the number in front of x.",
    "An example with y: 3y + 4 = 25 gives 3y = 25 − 4 = 21, so y = 21 ÷ 3 = 7.",
  ],
  teachRule: { traces: 3, distinctMistakesMin: 2, triesMax: 2 },
  proofRule: { solve: 3, apply: 1, allCorrect: true },
};

// ---------- word problem: an auto-rickshaw ride ----------

export function linearTwoStepApply(rng: Rng): ApplyItem {
  const perKm = randInt(rng, 8, 25);
  const fixed = 10 * randInt(rng, 2, 10);
  const km = randInt(rng, 2, 30);
  const total = perKm * km + fixed;
  return {
    instance: makeTwoStepInstance({ a: perKm, b: fixed, d: total }, rng.seed),
    text: `An auto-rickshaw charges a fixed ₹${fixed} plus ₹${perKm} for every km. A ride cost ₹${total}. How many km long was the ride?`,
    textHi: `एक ऑटो-रिक्शा ₹${fixed} तय शुल्क और हर किमी के ₹${perKm} लेता है। एक सवारी का किराया ₹${total} हुआ। सवारी कितने किमी लंबी थी?`,
  };
}
