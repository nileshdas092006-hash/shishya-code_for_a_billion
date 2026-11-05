import { asFraction } from "../answer";
import { frac } from "../fraction";
import { checkCollegeLine } from "../lineCheck";
import { randInt, type Rng } from "../rng";
import type { ApplyItem, Instance, LineCheck, Mistake, SkillSpec, Trace } from "../types";
import { MINUS, mistakesAreSound, nonZero, num, toTrace } from "./helpers";

// College pack (F12): the determinant of a 2×2 matrix [[a, b], [c, d]]. params: a, b, c, d. Its text is the plain form
// [[3, −2], [4, 5]], which <Equation> draws as two rows. The working, with whole-number arithmetic checked by code:
//   the question:              [[3, −2], [4, 5]]
//   main diagonal − second:    3 × 5 − (−2) × 4
//   the two products:          15 − (−8)
//   the answer:                23

export const DET_SKILL_ID = "col.matrix.det2";
const VERSION = "1.0.0";
const MAX_TRIES = 1000;
const MAX_ENTRY = 9;

type P = { a: number; b: number; c: number; d: number };
const P = (inst: Instance): P => ({ a: inst.params.a, b: inst.params.b, c: inst.params.c, d: inst.params.d });

const questionText = ({ a, b, c, d }: P) => `[[${num(a)}, ${num(b)}], [${num(c)}, ${num(d)}]]`;
/** A negative number inside a product or after a sign is written in brackets: (−2) × 4, 15 − (−8). */
const br = (n: number) => (n < 0 ? `(${MINUS}${-n})` : `${n}`);
const times = (x: number, y: number) => `${br(x)} × ${br(y)}`;

/** The two lines every working here has: the products written out, then worked out. */
function working(question: string, x1: number, y1: number, sign: "+" | typeof MINUS, x2: number, y2: number): { lines: string[]; value: number } {
  const first = x1 * y1;
  const second = x2 * y2;
  const value = sign === "+" ? first + second : first - second;
  return { lines: [question, `${times(x1, y1)} ${sign} ${times(x2, y2)}`, `${num(first)} ${sign} ${br(second)}`, num(value)], value };
}

const correctWorking = (p: P) => working(questionText(p), p.a, p.d, MINUS, p.b, p.c);

export function makeDetInstance(p: P, seed: number): Instance {
  return { skillId: DET_SKILL_ID, version: VERSION, seed, params: { ...p }, text: questionText(p), answer: frac(p.a * p.d - p.b * p.c) };
}

/** The two diagonals' products as text and values, for "How we checked". */
export function products(inst: Instance) {
  const { a, b, c, d } = P(inst);
  return { main: times(a, d), second: times(b, c), mainValue: a * d, secondValue: b * c };
}

function solve(inst: Instance): { trace: Trace; answer: ReturnType<typeof frac> } {
  const { lines, value } = correctWorking(P(inst));
  return { trace: toTrace(lines), answer: frac(value) };
}

function checkLine(inst: Instance, line: number, typed: string): LineCheck {
  const correct = correctWorking(P(inst)).lines;
  return checkCollegeLine(asFraction(inst.answer), correct[line - 2] ?? correct[0], typed, line >= correct.length);
}

// ---------- mistakes ----------

const fromWorking = (w: { lines: string[]; value: number }) => ({ trace: toTrace(w.lines), answer: frac(w.value), firstWrongLine: 2 });

const addedTheProducts: Mistake = {
  id: "added-the-products",
  label: "Added the two diagonal products: ad + bc",
  childLabel: "The determinant subtracts the second diagonal's product.",
  stepType: "sign",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    return fromWorking(working(questionText(p), p.a, p.d, "+", p.b, p.c));
  },
};

const reversedOrder: Mistake = {
  id: "reversed-order",
  label: "Subtracted in the wrong order: bc − ad",
  childLabel: "Start with the main diagonal (top-left × bottom-right).",
  stepType: "operation",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    return fromWorking(working(questionText(p), p.b, p.c, MINUS, p.a, p.d));
  },
};

const rowsNotDiagonals: Mistake = {
  id: "rows-not-diagonals",
  label: "Multiplied along the rows: ab − cd",
  childLabel: "Multiply along the diagonals, not along the rows.",
  stepType: "operation",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    return fromWorking(working(questionText(p), p.a, p.b, MINUS, p.c, p.d));
  },
};

const mistakes: Mistake[] = [addedTheProducts, reversedOrder, rowsNotDiagonals];

// ---------- questions ----------

/** a, b, c, d in −9…9, none 0, at least one negative, ad − bc ≠ 0; the correct answer and the mistakes' answers all differ. */
function generate(rng: Rng): Instance {
  for (let i = 0; i < MAX_TRIES; i++) {
    const p = { a: nonZero(rng, MAX_ENTRY), b: nonZero(rng, MAX_ENTRY), c: nonZero(rng, MAX_ENTRY), d: nonZero(rng, MAX_ENTRY) };
    if (!(p.a < 0 || p.b < 0 || p.c < 0 || p.d < 0) || p.a * p.d === p.b * p.c) continue;
    const inst = makeDetInstance(p, rng.seed);
    if (mistakesAreSound(inst, mistakes)) return inst;
  }
  throw new Error(`${DET_SKILL_ID}: no valid question after ${MAX_TRIES} tries (seed ${rng.seed})`);
}

export const colMatrixDet2: SkillSpec = {
  id: DET_SKILL_ID,
  version: VERSION,
  statement: "Find the determinant of a 2×2 matrix.",
  prerequisites: [],
  answerKind: "number",
  generate,
  solve,
  checkLine,
  mistakes,
  // The example's answer (197) is outside the questions' range (−162…162), so a hint never gives an answer away.
  hintLadder: [
    "A 2×2 determinant uses the two diagonals: the main diagonal (top-left to bottom-right) and the second diagonal (top-right to bottom-left).",
    "Multiply along each diagonal. Keep every number's sign: write negative numbers in brackets.",
    "The determinant is the main diagonal's product minus the second diagonal's product. Subtracting a negative number is the same as adding its opposite.",
    "An example with other numbers: with rows 20, 1 and 3, 10 the determinant is 20 × 10 − 1 × 3 = 197.",
  ],
  teachRule: { traces: 3, distinctMistakesMin: 2, triesMax: 2 },
  proofRule: { solve: 3, apply: 1, allCorrect: true },
};

// ---------- word problems: two places a first-year meets a determinant ----------

/** "3x − 2y": the left side of an equation in x and y. */
const leftSide = (px: number, py: number) => `${num(px)}x ${py < 0 ? MINUS : "+"} ${Math.abs(py)}y`;

export function colMatrixDet2Apply(rng: Rng): ApplyItem {
  const instance = generate(rng);
  const { a, b, c, d } = P(instance);
  if (randInt(rng, 0, 1) === 0) {
    const equations = `${leftSide(a, b)} = 7, ${leftSide(c, d)} = 4`;
    return {
      instance,
      text: `To solve the equations ${equations} by Cramer's rule, you first need the determinant of the coefficient matrix. What is this determinant?`,
      // HINDI-REVIEW
      textHi: `समीकरणों ${equations} को क्रैमर नियम से हल करने के लिए पहले गुणांक आव्यूह का सारणिक चाहिए। यह सारणिक कितना है?`,
    };
  }
  const images = `(1, 0) को (${num(a)}, ${num(c)}) और (0, 1) को (${num(b)}, ${num(d)})`;
  const imagesEn = `(1, 0) to (${num(a)}, ${num(c)}) and (0, 1) to (${num(b)}, ${num(d)})`;
  return {
    instance,
    text: `A linear map of the plane sends ${imagesEn}. What is the determinant of its matrix?`,
    // HINDI-REVIEW
    textHi: `समतल का एक रैखिक प्रतिचित्रण ${images} पर भेजता है। इसके आव्यूह का सारणिक कितना है?`,
  };
}
