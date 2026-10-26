import { createRng } from "./rng";
import { applies, type Answer, type Instance, type Mistake, type SkillSpec, type Trace } from "./types";

// A worked example of one mistake, for the teacher (stuck board, review card, open mistake export): the first
// generated question from `firstSeed` on that the mistake APPLIES to, worked through with that mistake. Pure and
// deterministic: the same skill, mistake and seed always give the same example.

export type MistakeExample = { instance: Instance; trace: Trace; answer: Answer; firstWrongLine: number };

const DEFAULT_TRIES = 500;

/** null if none of the `tries` questions from `firstSeed` on fits (e.g. a formula that always divides by zero). */
export function mistakeExample(skill: SkillSpec, mistake: Mistake, firstSeed = 1, tries = DEFAULT_TRIES): MistakeExample | null {
  for (let seed = firstSeed; seed < firstSeed + tries; seed++) {
    const instance = skill.generate(createRng(seed));
    if (!applies(mistake, instance)) continue;
    try {
      const { trace, answer, firstWrongLine } = mistake.apply(instance);
      return { instance, trace, answer, firstWrongLine };
    } catch {
      // e.g. a mined formula that divides by 0 on this question: try the next one
    }
  }
  return null;
}
