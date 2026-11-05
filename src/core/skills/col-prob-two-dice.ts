import { equals, frac, toString, type Fraction } from "../fraction";
import { checkCollegeLine, evaluateArithmetic, lineResult, timesFromX } from "../lineCheck";
import { randInt, type Rng } from "../rng";
import type { ApplyItem, Instance, LineCheck, Mistake, SkillSpec, Trace } from "../types";
import { mistakesAreSound, toTrace } from "./helpers";

// College pack (F12): probability with two fair dice. params: t (0 = "the sum is k", 1 = "the sum is at least k",
// 2 = "the sum is at most k") and k. The working, each line checked by code with exact fractions:
//   the question
//   all the outcomes:          6 × 6
//   the outcomes that fit:     6
//   the fraction:              6/36
//   its simplest form:         1/6   (left out when the fraction is already in its simplest form)
// The lines are not "the same value" as each other: each line counts something, so checkLine says what it should be.

export const DICE_SKILL_ID = "col.prob.two-dice";
const VERSION = "1.0.0";
const MAX_TRIES = 1000;
const SUM = 0;
const AT_LEAST = 1;
const AT_MOST = 2;
const FACES = 6;
export const ALL_OUTCOMES = FACES * FACES;
const ALL_SUMS = 11;
const UNORDERED_PAIRS = 21;

type P = { t: number; k: number };
const P = (inst: Instance): P => ({ t: inst.params.t, k: inst.params.k });

const fits = (t: number, k: number, sum: number) => (t === SUM ? sum === k : t === AT_LEAST ? sum >= k : sum <= k);

/** favourable: ordered outcomes that fit; unordered: those pairs with (1, 6) and (6, 1) counted once; sums: the different sums that fit. */
export function diceCounts(t: number, k: number) {
  let favourable = 0;
  let unordered = 0;
  const sums = new Set<number>();
  for (let x = 1; x <= FACES; x++) {
    for (let y = 1; y <= FACES; y++) {
      if (!fits(t, k, x + y)) continue;
      favourable++;
      if (x <= y) unordered++;
      sums.add(x + y);
    }
  }
  return { favourable, unordered, sums: sums.size };
}

const condition = ({ t, k }: P) => (t === SUM ? `${k}` : t === AT_LEAST ? `at least ${k}` : `at most ${k}`);
const questionText = (p: P) => `Two fair dice are rolled. What is the probability that the sum is ${condition(p)}?`;

/** Question · total · count · count/total, then the simplest form if it is different. */
function lines(p: P, total: string, totalValue: number, count: number): { lines: string[]; value: Fraction } {
  const fraction = `${count}/${totalValue}`;
  const value = frac(count, totalValue);
  const simplest = toString(value);
  return { lines: [questionText(p), total, `${count}`, fraction, ...(simplest === fraction ? [] : [simplest])], value };
}

const correctWorking = (p: P) => lines(p, `${FACES} × ${FACES}`, ALL_OUTCOMES, diceCounts(p.t, p.k).favourable);

export function makeDiceInstance(p: P, seed: number): Instance {
  return { skillId: DICE_SKILL_ID, version: VERSION, seed, params: { ...p }, text: questionText(p), answer: correctWorking(p).value };
}

function solve(inst: Instance): { trace: Trace; answer: Fraction } {
  const { lines: correct, value } = correctWorking(P(inst));
  return { trace: toTrace(correct), answer: value };
}

function checkLine(inst: Instance, line: number, typed: string): LineCheck {
  const p = P(inst);
  const { lines: correct, value } = correctWorking(p);
  const above = correct[line - 2] ?? correct[0];
  if (line === 2) return checkCollegeLine(frac(ALL_OUTCOMES), above, typed, false, "teach.fix.allOutcomes");
  if (line === 3) return checkCollegeLine(frac(diceCounts(p.t, p.k).favourable), above, typed, false, "teach.fix.favourable");
  const check = checkCollegeLine(value, above, typed, false, "teach.fix.sameFraction");
  if (!check.ok || line < correct.length) return check;
  // the last line: one fraction that cannot be made simpler
  const shown = timesFromX(typed).replace(/\s+/g, "");
  return /^\d+\/\d+$/.test(shown) && shown === toString(evaluateArithmetic(shown)) && equals(evaluateArithmetic(shown), value)
    ? check
    : lineResult(false, "teach.fix.simplestFraction");
}

// ---------- mistakes ----------

const sumsEquallyLikely: Mistake = {
  id: "sums-equally-likely",
  label: "Treated the 11 possible sums as equally likely",
  childLabel: "The 11 sums are not equally likely: 7 can come up in more ways than 2 can. Count the 36 ordered pairs, not the sums.",
  stepType: "operation",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    const { lines: wrong, value } = lines(p, `${ALL_SUMS}`, ALL_SUMS, diceCounts(p.t, p.k).sums);
    return { trace: toTrace(wrong), answer: value, firstWrongLine: 2 };
  },
};

const unorderedPairs: Mistake = {
  id: "unordered-pairs",
  label: "Counted unordered pairs, out of 21",
  childLabel: "(1, 6) and (6, 1) are different outcomes, so there are 36 outcomes, not 21. Count ordered pairs.",
  stepType: "operation",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    const { lines: wrong, value } = lines(p, `${UNORDERED_PAIRS}`, UNORDERED_PAIRS, diceCounts(p.t, p.k).unordered);
    return { trace: toTrace(wrong), answer: value, firstWrongLine: 2 };
  },
};

const oneOrderOnly: Mistake = {
  id: "one-order-only",
  label: "Counted each pair in one order only, out of 36",
  childLabel: "You counted (1, 6) but not (6, 1). When the two numbers are different, count both orders.",
  stepType: "operation",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    const { lines: wrong, value } = lines(p, `${FACES} × ${FACES}`, ALL_OUTCOMES, diceCounts(p.t, p.k).unordered);
    return { trace: toTrace(wrong), answer: value, firstWrongLine: 3 };
  },
};

const mistakes: Mistake[] = [sumsEquallyLikely, unorderedPairs, oneOrderOnly];

// ---------- questions ----------

/** t 0: k 2…12; t 1: k 3…12; t 2: k 2…11. A draw where a mistake gives the right answer (one outcome: 2 or 12) is rejected. */
function draw(rng: Rng): Instance {
  for (let i = 0; i < MAX_TRIES; i++) {
    const t = randInt(rng, SUM, AT_MOST);
    const k = randInt(rng, t === AT_LEAST ? 3 : 2, t === AT_MOST ? 11 : 12);
    const inst = makeDiceInstance({ t, k }, rng.seed);
    if (mistakesAreSound(inst, mistakes)) return inst;
  }
  throw new Error(`${DICE_SKILL_ID}: no valid question after ${MAX_TRIES} tries (seed ${rng.seed})`);
}

export const colProbTwoDice: SkillSpec = {
  id: DICE_SKILL_ID,
  version: VERSION,
  statement: "Find a probability with two fair dice.",
  prerequisites: [],
  answerKind: "number",
  generate: draw,
  solve,
  checkLine,
  mistakes,
  // The example is about coins, and its probability (1/2) is never the answer to a dice question here.
  hintLadder: [
    "Each die has 6 faces, and the two dice are different dice. Count outcomes as ordered pairs: (first die, second die).",
    "All the outcomes are equally likely. Work out how many there are in all.",
    "List the pairs that fit the question. (1, 2) and (2, 1) are two different outcomes; a pair like (3, 3) is one outcome.",
    "Probability = outcomes that fit ÷ all outcomes. An example with two coins: HH, HT, TH and TT are 4 outcomes; exactly one head has 2 of them (HT and TH), so the probability is 2/4 = 1/2.",
  ],
  teachRule: { traces: 3, distinctMistakesMin: 2, triesMax: 2 },
  proofRule: { solve: 3, apply: 1, allCorrect: true },
};

// ---------- word problems: board games ----------

export function colProbTwoDiceApply(rng: Rng): ApplyItem {
  const instance = draw(rng);
  const { t, k } = P(instance);
  if (t === SUM) {
    return {
      instance,
      text: `In a board game you roll two fair dice, and you get an extra turn when the sum is exactly ${k}. What is the probability of an extra turn?`,
      // HINDI-REVIEW
      textHi: `एक बोर्ड गेम में तुम दो निष्पक्ष पासे फेंकते हो, और योग ठीक ${k} आने पर एक अतिरिक्त मौका मिलता है। अतिरिक्त मौका मिलने की प्रायिकता क्या है?`,
    };
  }
  if (t === AT_LEAST) {
    return {
      instance,
      text: `To win a round of a game, the sum of two fair dice must be at least ${k}. What is the probability of winning the round?`,
      // HINDI-REVIEW
      textHi: `किसी खेल का एक दौर जीतने के लिए दो निष्पक्ष पासों का योग कम से कम ${k} होना चाहिए। दौर जीतने की प्रायिकता क्या है?`,
    };
  }
  return {
    instance,
    text: `In a game you are safe if the sum of two fair dice is at most ${k}. What is the probability of being safe?`,
    // HINDI-REVIEW
    textHi: `एक खेल में अगर दो निष्पक्ष पासों का योग अधिक से अधिक ${k} हो, तो तुम सुरक्षित हो। सुरक्षित होने की प्रायिकता क्या है?`,
  };
}
