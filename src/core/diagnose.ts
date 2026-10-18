import { equals, type Fraction } from "./fraction";
import type { Instance, SkillSpec } from "./types";

/**
 * Which ONE mistake reproduces this wrong answer? "unknown" if none does, or if more than one does
 * (we never guess between two explanations).
 */
export function diagnose(skill: SkillSpec, instance: Instance, answer: Fraction): string {
  const matches = skill.mistakes.filter((m) => equals(m.apply(instance).answer, answer));
  return matches.length === 1 ? matches[0].id : "unknown";
}
