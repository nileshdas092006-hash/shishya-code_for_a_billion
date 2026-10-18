import type { Rng } from "../rng";
import type { SkillSpec } from "../types";
import { linearBothSides } from "./linear-both-sides";
import { generateApply as linearBothSidesApply, type ApplyItem } from "./linear-both-sides-apply";

// Every skill Shishya knows, in teaching order. Screens and the server read skills ONLY from here,
// and must not assume there is just one.

export type SkillEntry = { spec: SkillSpec; generateApply: (rng: Rng) => ApplyItem };

export const SKILLS: readonly SkillEntry[] = [{ spec: linearBothSides, generateApply: linearBothSidesApply }];

export function getSkillEntry(skillId: string): SkillEntry | undefined {
  return SKILLS.find((s) => s.spec.id === skillId);
}
