import { parseAnswerFor, sameAnswer } from "./answer";
import { createRng, randInt, type Rng } from "./rng";
import { getSkillEntry } from "./skills";
import type { Instance, Pack } from "./types";

// The Shishya Challenge's checks (F11): a before check and an after check of 6 questions each (2 one-step,
// 2 two-step, 2 "x on both sides") and an optional later (delayed) check of 4. Every question is made by its
// skill's own generator from one seed, so a check can always be re-created and scored again from its seeds.
// Pure: the only randomness is the seeded generator passed in.
// Each pack has its own plan (F12): the college pack checks 2×2 determinants and two-dice probability.

export type CheckPhase = "pre" | "post" | "delayed";

const ONE = "alg.linear.one-step";
const TWO = "alg.linear.two-step";
const BOTH = "alg.linear.both-sides";
export const DET = "col.matrix.det2";
export const DICE = "col.prob.two-dice";

export const CHECK_PLANS: Readonly<Record<CheckPhase, readonly string[]>> = {
  pre: [ONE, ONE, TWO, TWO, BOTH, BOTH],
  post: [ONE, ONE, TWO, TWO, BOTH, BOTH],
  delayed: [ONE, TWO, BOTH, BOTH],
};

export const PACK_CHECK_PLANS: Readonly<Record<Pack, Readonly<Record<CheckPhase, readonly string[]>>>> = {
  school: CHECK_PLANS,
  college: {
    pre: [DET, DET, DET, DICE, DICE, DICE],
    post: [DET, DET, DET, DICE, DICE, DICE],
    delayed: [DET, DET, DICE, DICE],
  },
};

const MAX_SEED = 2 ** 31 - 2;
const MAX_TRIES = 1000;

/** One question of a check: the skill's own question for this seed. */
export function checkQuestion(skillId: string, seed: number): Instance {
  const entry = getSkillEntry(skillId);
  if (!entry) throw new Error(`Unknown skill: ${skillId}`);
  return entry.spec.generate(createRng(seed));
}

/** Two questions with the same key are the same question (the same skill and the same numbers). */
export const checkKey = (skillId: string, params: Record<string, number>) => `${skillId}|${JSON.stringify(params)}`;

/** A seed, drawn from rng, whose question on this skill is not in avoid. Throws rather than repeat a question. */
export function nextCheckSeed(rng: Rng, skillId: string, avoid: ReadonlySet<string>): number {
  for (let i = 0; i < MAX_TRIES; i++) {
    const seed = randInt(rng, 1, MAX_SEED);
    if (!avoid.has(checkKey(skillId, checkQuestion(skillId, seed).params))) return seed;
  }
  throw new Error(`${skillId}: no new check question after ${MAX_TRIES} tries`);
}

/** The seeds of one check, in its plan's order: all different questions, and none of the questions in avoid. */
export function checkSeeds(rng: Rng, phase: CheckPhase, avoid: ReadonlySet<string>, pack: Pack = "school"): number[] {
  const used = new Set(avoid);
  return PACK_CHECK_PLANS[pack][phase].map((skillId) => {
    const seed = nextCheckSeed(rng, skillId, used);
    used.add(checkKey(skillId, checkQuestion(skillId, seed).params));
    return seed;
  });
}

/** One answered (or unanswered) question of a check, as stored. */
export type CheckItem = { skillId: string; seed: number; paramsJson: string; answer: string | null };

/**
 * How many questions were answered right, worked out again from the seeds: a question counts only if its stored
 * numbers are the ones its seed makes and the child's own answer equals the answer worked out now.
 */
export function scoreCheck(items: readonly CheckItem[]): number {
  return items.filter((item) => {
    if (item.answer === null) return false;
    const entry = getSkillEntry(item.skillId);
    if (!entry) return false;
    const question = entry.spec.generate(createRng(item.seed));
    if (JSON.stringify(question.params) !== item.paramsJson) return false;
    const typed = parseAnswerFor(entry.spec.answerKind, item.answer);
    return typed.ok && sameAnswer(typed.value, question.answer);
  }).length;
}

