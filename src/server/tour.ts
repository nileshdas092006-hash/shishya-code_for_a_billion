import { diagnose } from "../core/diagnose";
import { createRng, randInt } from "../core/rng";
import { applies, type Answer, type Instance } from "../core/types";
import { defaultRegistry, type Registry } from "./skills";
import type { MasteryState } from "./store";

// The Judge Tour's made-up class: the SAME picture every time, from a fixed seed. Every seeded question is a real
// question from a skill generator (with its stored seed), and every seeded answer is either the correct answer or
// exactly one mistake's answer, both worked out by src/core, so every number on the board can be re-checked.
// No AI is used here. Mastery for these children is written only by mastery.seedSandboxMastery.

export const TOUR_SKILL = "alg.linear.both-sides";
export const TOUR_GRADE = 8;
export const TOUR_SECTION = "T";
/** The judge's own child. Never typed in: the tour logs the judge in directly. */
export const TOUR_JUDGE_CODE = "8T-YOU";
/** The made-up classmate whose proof is shown next to the judge's (stop 3). */
export const TOUR_CLASSMATE_CODE = "8T-26";
/** Tours that may start in one hour, across every judge (counted in the database). */
export const TOUR_MAX_PER_HOUR = 30;
export const TOUR_STOPS = 6;
const TOUR_SEED = 20261025;
const MAX_TRIES = 1000;

const SKILL_ORDER = ["alg.integers.ops", "alg.like-terms", "alg.linear.one-step", "alg.linear.two-step", "alg.linear.both-sides"];

/** One seeded practice answer. minutesAgo: when it was answered, counted back from the start of the tour. */
export type TourAnswer = {
  skillId: string;
  seed: number;
  instance: Instance;
  given: Answer;
  correct: boolean;
  mistakeId: string | null;
  minutesAgo: number;
};
export type TourChild = {
  code: string;
  /** State per skill (a skill not listed is LOCKED). */
  states: Record<string, MasteryState>;
  answers: TourAnswer[];
  /** Skills this child proved with a real, fully correct proof run (made with fresh seeds when the tour starts). */
  proofs: string[];
};

const M = "MASTERED";
const K = "KEY1";
const O = "OPEN";
const N = "NOT_YET";
type Cell = MasteryState | null;
type Role = {
  states: Cell[];
  wrong?: { skillId: string; mistakeId: string; questions: number };
  right: { skillId: string; n: number };
  proof?: boolean;
};

const BOTH = "alg.linear.both-sides";
const ONE = "alg.linear.one-step";

/** The 30 made-up children, in order 8T-01 … 8T-30. */
function roles(): Role[] {
  const out: Role[] = [];
  // 1–14: a pattern on both sides at line 3 (kept the sign of the number when taking it across)
  for (let i = 1; i <= 14; i++) {
    out.push({
      states: [M, M, M, i <= 4 ? K : M, i >= 13 ? K : O],
      wrong: { skillId: BOTH, mistakeId: "kept-const-sign", questions: i % 3 === 0 ? 3 : 2 },
      right: { skillId: BOTH, n: 2 },
    });
  }
  // 15–20: divided the wrong way round (x = a ÷ d), a pattern on one-step equations
  for (let i = 15; i <= 20; i++) {
    out.push({
      states: [M, i <= 17 ? K : M, O, O, null],
      wrong: { skillId: ONE, mistakeId: "divided-wrong-way", questions: i === 15 ? 3 : 2 },
      right: { skillId: ONE, n: 2 },
    });
  }
  // 21–25: one slip each (a known mistake on one question only)
  out.push({ states: [M, M, M, M, O], wrong: { skillId: BOTH, mistakeId: "kept-x-sign", questions: 1 }, right: { skillId: BOTH, n: 2 } });
  out.push({ states: [M, M, M, M, O], wrong: { skillId: BOTH, mistakeId: "forgot-to-divide", questions: 1 }, right: { skillId: BOTH, n: 1 } });
  out.push({ states: [M, M, M, M, O], wrong: { skillId: BOTH, mistakeId: "dropped-constant", questions: 1 }, right: { skillId: BOTH, n: 2 } });
  out.push({
    states: [M, M, M, O, null],
    wrong: { skillId: "alg.linear.two-step", mistakeId: "divided-first", questions: 1 },
    right: { skillId: "alg.linear.two-step", n: 2 },
  });
  out.push({
    states: [M, O, null, null, null],
    wrong: { skillId: "alg.like-terms", mistakeId: "dropped-sign", questions: 1 },
    right: { skillId: "alg.like-terms", n: 2 },
  });
  // 26–30: no mistakes this week; two have proved both sides (26 is the classmate shown at stop 3)
  out.push({ states: [M, M, M, M, M], right: { skillId: BOTH, n: 3 }, proof: true });
  out.push({ states: [M, M, M, M, M], right: { skillId: BOTH, n: 2 }, proof: true });
  out.push({ states: [M, M, M, M, K], right: { skillId: BOTH, n: 3 } });
  out.push({ states: [M, M, M, M, K], right: { skillId: BOTH, n: 2 } });
  out.push({ states: [M, M, M, M, N], right: { skillId: BOTH, n: 2 } });
  return out;
}

/** The judge's own child: the earlier skills mastered, the tour's skill open (teacher-unlocked), nothing answered yet. */
export const TOUR_JUDGE_STATES: Record<string, MasteryState> = Object.fromEntries(
  SKILL_ORDER.map((id) => [id, id === TOUR_SKILL ? O : M]),
);

/** The made-up children with their seeded answers. Pure and deterministic: the same result on every call. */
export function tourPlan(registry: Registry = defaultRegistry): TourChild[] {
  const rng = createRng(TOUR_SEED);
  return roles().map((role, index) => {
    const code = `8${TOUR_SECTION}-${String(index + 1).padStart(2, "0")}`;
    const seen = new Set<string>();
    const answers: TourAnswer[] = [];
    /** A new question for this child on this skill that `ok` accepts. */
    const pick = (skillId: string, ok: (inst: Instance) => boolean) => {
      const spec = registry[skillId].spec;
      for (let i = 0; i < MAX_TRIES; i++) {
        const seed = randInt(rng, 1, 2 ** 31 - 2);
        const instance = spec.generate(createRng(seed));
        const key = `${skillId}|${JSON.stringify(instance.params)}`;
        if (seen.has(key) || !ok(instance)) continue;
        seen.add(key);
        return { seed, instance };
      }
      throw new Error(`tour: no question found for ${skillId}`);
    };
    const minutesAgo = () => (30 - index) * 90 + answers.length * 7 + 60;
    if (role.wrong) {
      const { skillId, mistakeId, questions } = role.wrong;
      const spec = registry[skillId].spec;
      const mistake = spec.mistakes.find((m) => m.id === mistakeId)!;
      for (let q = 0; q < questions; q++) {
        // a question where this mistake applies and is the ONLY explanation of its answer
        const { seed, instance } = pick(skillId, (inst) => applies(mistake, inst) && diagnose(spec, inst, mistake.apply(inst).answer) === mistakeId);
        answers.push({ skillId, seed, instance, given: mistake.apply(instance).answer, correct: false, mistakeId, minutesAgo: minutesAgo() });
      }
    }
    for (let q = 0; q < role.right.n; q++) {
      const { seed, instance } = pick(role.right.skillId, () => true);
      answers.push({ skillId: role.right.skillId, seed, instance, given: instance.answer, correct: true, mistakeId: null, minutesAgo: minutesAgo() });
    }
    const states = Object.fromEntries(
      role.states.flatMap((s, i): [string, MasteryState][] => (s ? [[SKILL_ORDER[i], s]] : [])),
    ) as Record<string, MasteryState>;
    return { code, states, answers, proofs: role.proof ? [BOTH] : [] };
  });
}
