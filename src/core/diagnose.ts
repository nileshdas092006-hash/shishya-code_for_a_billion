import { sameAnswer } from "./answer";
import { applies, type Answer, type Instance, type SkillSpec } from "./types";

/**
 * Which ONE mistake reproduces this wrong answer? "unknown" if none does, or if more than one does
 * (we never guess between two explanations). Only mistakes that apply to this question are considered.
 */
export function diagnose(skill: SkillSpec, instance: Instance, answer: Answer): string {
  const matches = skill.mistakes.filter((m) => applies(m, instance) && sameAnswer(m.apply(instance).answer, answer));
  return matches.length === 1 ? matches[0].id : "unknown";
}
