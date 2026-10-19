import { asFraction, sameAnswer } from "../answer";
import { equivalent, parseEquation } from "../equation";
import { formatEquation as eq, fracText } from "../format";
import { div, frac, type Fraction } from "../fraction";
import { lineResult } from "../lineCheck";
import { randInt, type Rng } from "../rng";
import { meetsTargetForm, type TraceLineNumber } from "../targetForm";
import type { Instance, LineCheck, Mistake, SkillSpec, Trace } from "../types";

// Equations a·x + b = c·x + d, e.g. 4x − 3 = 2x + 7 (a = 4, b = −3, c = 2, d = 7, answer 5).

const SKILL_ID = "alg.linear.both-sides";
const VERSION = "1.0.0";
const MAX_TRIES = 1000;

type Params = Instance["params"];

const toTrace = (lines: string[]): Trace => lines.map((text) => ({ text }));

// ---------- Questions ----------

export function makeInstance(params: Params, seed: number): Instance {
  const { a, b, c, d } = params;
  return {
    skillId: SKILL_ID,
    version: VERSION,
    seed,
    params: { a, b, c, d },
    text: eq([[a, true], [b, false]], [[c, true], [d, false]]),
    answer: div(frac(d - b), frac(a - c)),
  };
}

/** A whole number in [−12, 12], never 0. */
function nonZero(rng: Rng): number {
  const v = randInt(rng, -12, 11);
  return v >= 0 ? v + 1 : v;
}

function followsRules(inst: Instance): boolean {
  const { a, b, c, d } = inst.params;
  const x = asFraction(inst.answer);
  if (x.den !== 1 || x.num === 0 || Math.abs(x.num) > 12) return false;
  if ([a, b, c, d].includes(x.num)) return false;
  const answers = [x, ...mistakes.map((m) => m.apply(inst).answer)];
  return answers.every((p, i) => answers.every((q, j) => i === j || !sameAnswer(p, q)));
}

function generate(rng: Rng): Instance {
  for (let i = 0; i < MAX_TRIES; i++) {
    const a = nonZero(rng);
    const b = nonZero(rng);
    const c = nonZero(rng);
    const d = nonZero(rng);
    if (a === c || b === d || a + c === 0 || Math.abs(a - c) === 1) continue;
    const inst = makeInstance({ a, b, c, d }, rng.seed);
    if (followsRules(inst)) return inst;
  }
  throw new Error(`${SKILL_ID}: no valid question after ${MAX_TRIES} tries (seed ${rng.seed})`);
}

// ---------- Correct solution ----------

function solve(inst: Instance): { trace: Trace; answer: Fraction } {
  const { a, b, c, d } = inst.params;
  const answer = div(frac(d - b), frac(a - c));
  return {
    trace: toTrace([
      inst.text,
      eq([[a, true], [-c, true], [b, false]], [[d, false]]), // subtract cx from both sides
      eq([[a, true], [-c, true]], [[d, false], [-b, false]]), // do the opposite of b on both sides
      eq([[a - c, true]], [[d - b, false]]),
      `x = ${fracText(answer)}`,
    ]),
    answer,
  };
}

// ---------- Checking a child's typed line (Teach the Shishya) ----------

/** Equal to the question, and the right shape for this line of the 5-line working (steps may be combined). */
function checkLine(inst: Instance, line: number, typed: string): LineCheck {
  const t = parseEquation(typed);
  if (!t.ok) return { ok: false, feedback: t.error, feedbackKey: t.errorKey, ...(t.errorParams ? { feedbackParams: t.errorParams } : {}) };
  const q = parseEquation(inst.text);
  if (!q.ok) throw new Error(`Question does not parse: ${inst.text}`);
  if (!equivalent(t.equation, q.equation)) return lineResult(false, "teach.fix.notEqual");
  if (line >= 2 && line <= 5 && !meetsTargetForm(t.equation, line as TraceLineNumber)) {
    return lineResult(false, `teach.fix.shape.${line as TraceLineNumber}`);
  }
  return lineResult(true, "teach.fix.ok");
}

// ---------- Authored mistakes ----------
// Deliberately NOT here: "divides by the original coefficient a" (gives 5/2 for the example).
// It is left for the Misconception Miner to discover from real children's answers.

const keptXSign: Mistake = {
  id: "kept-x-sign",
  label: "Took the x-term to the left by adding it instead of subtracting it: (a + c)x = d − b",
  childLabel:
    "To remove the x-term from the right side, do the same operation on both sides: subtract it from both sides. Here it was added on the left side instead.",
  stepType: "move-x",
  origin: "authored",
  apply(inst) {
    const { a, b, c, d } = inst.params;
    const answer = div(frac(d - b), frac(a + c));
    return {
      trace: toTrace([
        inst.text,
        eq([[a, true], [c, true], [b, false]], [[d, false]]),
        eq([[a, true], [c, true]], [[d, false], [-b, false]]),
        eq([[a + c, true]], [[d - b, false]]),
        `x = ${fracText(answer)}`,
      ]),
      answer,
      firstWrongLine: 2,
    };
  },
};

const droppedConstant: Mistake = {
  id: "dropped-constant",
  label: "Forgot the constant when collecting numbers: (a − c)x = d",
  childLabel:
    "The number next to the x-term was lost. To remove it from the left side, do the opposite operation on both sides. It cannot just be left out.",
  stepType: "move-const",
  origin: "authored",
  apply(inst) {
    const { a, b, c, d } = inst.params;
    const answer = div(frac(d), frac(a - c));
    return {
      trace: toTrace([
        inst.text,
        eq([[a, true], [-c, true], [b, false]], [[d, false]]),
        eq([[a, true], [-c, true]], [[d, false]]),
        eq([[a - c, true]], [[d, false]]),
        `x = ${fracText(answer)}`,
      ]),
      answer,
      firstWrongLine: 3,
    };
  },
};

const keptConstSign: Mistake = {
  id: "kept-const-sign",
  label: "Took the constant across without the opposite operation: (a − c)x = d + b",
  childLabel:
    "To remove a number from one side, do the opposite operation on both sides. To remove − 3, add 3 to both sides. To remove + 3, subtract 3 from both sides.",
  stepType: "move-const",
  origin: "authored",
  apply(inst) {
    const { a, b, c, d } = inst.params;
    const answer = div(frac(d + b), frac(a - c));
    return {
      trace: toTrace([
        inst.text,
        eq([[a, true], [-c, true], [b, false]], [[d, false]]),
        eq([[a, true], [-c, true]], [[d, false], [b, false]]),
        eq([[a - c, true]], [[d + b, false]]),
        `x = ${fracText(answer)}`,
      ]),
      answer,
      firstWrongLine: 3,
    };
  },
};

const forgotToDivide: Mistake = {
  id: "forgot-to-divide",
  label: "Reached (a − c)x = d − b, then wrote x = d − b without dividing",
  childLabel:
    "This line still tells you what a number times x is. To find x itself, divide both sides by the number in front of x.",
  stepType: "divide",
  origin: "authored",
  apply(inst) {
    const { b, d } = inst.params;
    const answer = frac(d - b);
    const lines = solve(inst).trace.slice(0, 4).map((l) => l.text);
    return { trace: toTrace([...lines, `x = ${fracText(answer)}`]), answer, firstWrongLine: 5 };
  },
};

const mistakes: Mistake[] = [keptXSign, droppedConstant, keptConstSign, forgotToDivide];

// ---------- The skill ----------

export const linearBothSides: SkillSpec = {
  id: SKILL_ID,
  version: VERSION,
  statement: "Solve linear equations with the unknown on both sides, such as 4x − 3 = 2x + 7.",
  prerequisites: ["alg.linear.two-step"],
  answerKind: "number",
  generate,
  solve,
  checkLine,
  mistakes,
  // The worked example's answer (15) is outside the generator's range (|x| ≤ 12), so a hint can never give away the answer.
  hintLadder: [
    "Look at both sides of the equation. The unknown x is on the left side and on the right side.",
    "Get all the x-terms on one side and all the numbers on the other side. Whatever you do to one side, do the same operation on the other side, so both sides stay equal.",
    "First remove the x-term from the right side by doing the opposite operation on both sides. Then remove the number next to the x-term the same way. Last, divide both sides by the number in front of x.",
    "An example with different numbers: 3x + 1 = x + 31. Subtract x from both sides: 2x + 1 = 31. Subtract 1 from both sides: 2x = 30. Divide both sides by 2: x = 15.",
  ],
  teachRule: { traces: 3, distinctMistakesMin: 2, triesMax: 2 },
  proofRule: { solve: 3, apply: 1, allCorrect: true },
};
