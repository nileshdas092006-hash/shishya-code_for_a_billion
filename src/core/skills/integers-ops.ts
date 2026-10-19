import { asFraction } from "../answer";
import { frac } from "../fraction";
import { checkArithmeticLine } from "../lineCheck";
import { randInt, type Rng } from "../rng";
import type { ApplyItem, Instance, LineCheck, Mistake, SkillSpec, Trace } from "../types";
import { MINUS, mistakesAreSound, nonZero, num, toTrace } from "./helpers";

// Skill 1: adding and subtracting integers, e.g. −7 + 3 = −4 and 5 − (−4) = 9 (NCERT: to subtract an integer, add
// its additive inverse). params: a, b and op (0 = add, 1 = subtract). The working:
//   (subtraction only) write it as adding the opposite:  5 − (−4) → 5 + 4
//   the sign rule:  same signs → add the sizes, keep the sign;  different signs → subtract the smaller size from the
//                   larger and use the sign of the number with the larger size:  −7 + 3 → −(7 − 3)
//   the answer:  −4

const SKILL_ID = "alg.integers.ops";
const VERSION = "1.0.0";
const MAX_TRIES = 1000;
const ADD = 0;
const SUB = 1;

type P = { a: number; b: number; op: number };
const P = (inst: Instance): P => ({ a: inst.params.a, b: inst.params.b, op: inst.params.op });

/** A second number that is negative is written in brackets: 5 − (−4). */
const br = (n: number) => (n < 0 ? `(${MINUS}${-n})` : `${n}`);
const questionText = ({ a, b, op }: P) => `${num(a)} ${op === SUB ? MINUS : "+"} ${br(b)}`;
/** The question as an addition x + y (subtracting b is adding −b). */
const addForm = ({ a, b, op }: P) => ({ x: a, y: op === SUB ? -b : b });
const addText = (x: number, y: number) => `${num(x)} + ${br(y)}`;

function signLine(x: number, y: number): string {
  if (x > 0 && y > 0) return `${x} + ${y}`;
  if (x < 0 && y < 0) return `${MINUS}(${-x} + ${-y})`;
  const large = Math.max(Math.abs(x), Math.abs(y));
  const small = Math.min(Math.abs(x), Math.abs(y));
  const negative = (Math.abs(x) > Math.abs(y) ? x : y) < 0;
  return negative ? `${MINUS}(${large} ${MINUS} ${small})` : `${large} ${MINUS} ${small}`;
}

function correctLines(p: P): string[] {
  const { x, y } = addForm(p);
  const lines = [questionText(p)];
  if (p.op === SUB) lines.push(addText(x, y));
  const s = signLine(x, y);
  if (s !== lines[lines.length - 1]) lines.push(s);
  lines.push(num(x + y));
  return lines;
}

export function makeIntegersInstance(p: P, seed: number): Instance {
  const { x, y } = addForm(p);
  return { skillId: SKILL_ID, version: VERSION, seed, params: { a: p.a, b: p.b, op: p.op }, text: questionText(p), answer: frac(x + y) };
}

function solve(inst: Instance): { trace: Trace; answer: ReturnType<typeof frac> } {
  const p = P(inst);
  const { x, y } = addForm(p);
  return { trace: toTrace(correctLines(p)), answer: frac(x + y) };
}

function checkLine(inst: Instance, line: number, typed: string): LineCheck {
  const correct = correctLines(P(inst));
  return checkArithmeticLine(asFraction(inst.answer), correct[line - 2] ?? correct[0], typed, line >= correct.length);
}

// ---------- mistakes ----------

const ignoresSign: Mistake = {
  id: "ignores-sign",
  label: "Ignored the minus signs and added the sizes: |x| + |y|",
  childLabel:
    "You added the sizes and left out the minus signs. When the signs are different, subtract the smaller size from the larger, and use the sign of the number with the larger size.",
  stepType: "sign",
  origin: "authored",
  appliesTo: (inst) => {
    const { x, y } = addForm(P(inst));
    return x < 0 || y < 0;
  },
  apply(inst) {
    const p = P(inst);
    const { x, y } = addForm(p);
    const lines = [questionText(p), ...(p.op === SUB ? [addText(x, y)] : [])];
    const firstWrongLine = lines.length + 1;
    const sum = Math.abs(x) + Math.abs(y);
    lines.push(`${Math.abs(x)} + ${Math.abs(y)}`, `${sum}`);
    return { trace: toTrace(lines), answer: frac(sum), firstWrongLine };
  },
};

const minusNegativeAsMinus: Mistake = {
  id: "minus-negative-as-minus",
  label: "Treated subtracting a negative as subtracting: a − (−n) → a − n",
  childLabel:
    "Subtracting a negative number is the same as adding its opposite: 5 − (−4) = 5 + 4. Write the subtraction as an addition first.",
  stepType: "sign",
  origin: "authored",
  appliesTo: (inst) => inst.params.op === SUB && inst.params.b < 0,
  apply(inst) {
    const { a, b } = P(inst);
    return { trace: toTrace([questionText(P(inst)), `${num(a)} ${MINUS} ${-b}`, num(a + b)]), answer: frac(a + b), firstWrongLine: 2 };
  },
};

const signOfFirst: Mistake = {
  id: "sign-of-first",
  label: "Subtracted the smaller size from the larger but kept the sign of the first number",
  childLabel:
    "You gave the answer the sign of the first number. When the signs are different, the answer takes the sign of the number with the larger size.",
  stepType: "sign",
  origin: "authored",
  appliesTo: (inst) => {
    const { x, y } = addForm(P(inst));
    return x * y < 0 && Math.abs(x) < Math.abs(y);
  },
  apply(inst) {
    const p = P(inst);
    const { x, y } = addForm(p);
    const lines = [questionText(p), ...(p.op === SUB ? [addText(x, y)] : [])];
    const firstWrongLine = lines.length + 1;
    const large = Math.abs(y);
    const small = Math.abs(x);
    const value = Math.sign(x) * (large - small);
    lines.push(x > 0 ? `${large} ${MINUS} ${small}` : `${MINUS}(${large} ${MINUS} ${small})`, num(value));
    return { trace: toTrace(lines), answer: frac(value), firstWrongLine };
  },
};

const mistakes: Mistake[] = [ignoresSign, minusNegativeAsMinus, signOfFirst];

// ---------- questions ----------

/** a, b in −12…12, never 0, at least one negative, different sizes; at least one mistake applies, all answers differ. */
function generate(rng: Rng): Instance {
  for (let i = 0; i < MAX_TRIES; i++) {
    const a = nonZero(rng, 12);
    const b = nonZero(rng, 12);
    const op = randInt(rng, 0, 1);
    if (!(a < 0 || b < 0) || Math.abs(a) === Math.abs(b)) continue;
    const inst = makeIntegersInstance({ a, b, op }, rng.seed);
    if (mistakesAreSound(inst, mistakes)) return inst;
  }
  throw new Error(`${SKILL_ID}: no valid question after ${MAX_TRIES} tries (seed ${rng.seed})`);
}

export const integersOps: SkillSpec = {
  id: SKILL_ID,
  version: VERSION,
  statement: "Add and subtract integers, such as −7 + 3 and 5 − (−4).",
  prerequisites: [],
  answerKind: "number",
  generate,
  solve,
  checkLine,
  mistakes,
  // The examples' answers (−30, 55) are outside the questions' range (−24…24), so a hint never gives an answer away.
  hintLadder: [
    "Look at the sign of each number before you start.",
    "To subtract an integer, add its additive inverse: a − (−n) is the same as a + n, and a − n is the same as a + (−n).",
    "If two integers have the same sign, add their sizes and keep that sign. If the signs are different, subtract the smaller size from the larger, and use the sign of the number with the larger size.",
    "Examples with other numbers: −50 + 20 = −(50 − 20) = −30, and 35 − (−20) = 35 + 20 = 55.",
  ],
  teachRule: { traces: 3, distinctMistakesMin: 2, triesMax: 2 },
  proofRule: { solve: 3, apply: 1, allCorrect: true },
};

// ---------- word problem: temperatures ----------

export function integersOpsApply(rng: Rng): ApplyItem {
  for (let i = 0; i < MAX_TRIES; i++) {
    const kind = randInt(rng, 0, 2);
    if (kind === 0) {
      const a = -randInt(rng, 2, 12);
      const rise = randInt(rng, 3, 15);
      if (Math.abs(a) === rise) continue;
      return {
        instance: makeIntegersInstance({ a, b: rise, op: ADD }, rng.seed),
        text: `At 6 am the temperature in Leh was ${num(a)} °C. By noon it had risen by ${rise} °C. What was the temperature at noon, in °C?`,
        textHi: `सुबह 6 बजे लेह का तापमान ${num(a)} °C था। दोपहर तक यह ${rise} °C बढ़ गया। दोपहर में तापमान कितने °C था?`,
      };
    }
    if (kind === 1) {
      const a = randInt(rng, 2, 10);
      const fall = randInt(rng, 3, 15);
      if (a === fall) continue;
      return {
        instance: makeIntegersInstance({ a, b: -fall, op: ADD }, rng.seed),
        text: `In the evening the temperature in Shimla was ${a} °C. By midnight it had fallen by ${fall} °C. What was the temperature at midnight, in °C?`,
        textHi: `शाम को शिमला का तापमान ${a} °C था। आधी रात तक यह ${fall} °C गिर गया। आधी रात को तापमान कितने °C था?`,
      };
    }
    const noon = randInt(rng, 1, 12);
    const night = -randInt(rng, 1, 12);
    if (noon === -night) continue;
    return {
      instance: makeIntegersInstance({ a: noon, b: night, op: SUB }, rng.seed),
      text: `In Kargil the temperature was ${noon} °C at noon and ${num(night)} °C at night. How many degrees warmer was it at noon than at night?`,
      textHi: `कारगिल में दोपहर को तापमान ${noon} °C और रात को ${num(night)} °C था। दोपहर में रात से कितने डिग्री अधिक गर्मी थी?`,
    };
  }
  throw new Error(`${SKILL_ID} word problem: none after ${MAX_TRIES} tries`);
}
