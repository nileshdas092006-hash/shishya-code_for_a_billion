import type { Rng } from "../rng";
import type { ApplyItem, SkillSpec } from "../types";
import { integersOps, integersOpsApply } from "./integers-ops";
import { likeTerms, likeTermsApply } from "./like-terms";
import { linearBothSides } from "./linear-both-sides";
import { generateApply as linearBothSidesApply } from "./linear-both-sides-apply";
import { linearOneStep, linearOneStepApply } from "./linear-one-step";
import { linearTwoStep, linearTwoStepApply } from "./linear-two-step";

// Every skill Shishya knows, in teaching order (each needs the one before). Screens and the server read skills
// ONLY from here, and must not assume there is just one.

export type SkillEntry = { spec: SkillSpec; generateApply: (rng: Rng) => ApplyItem };

export const SKILLS: readonly SkillEntry[] = [
  { spec: integersOps, generateApply: integersOpsApply },
  { spec: likeTerms, generateApply: likeTermsApply },
  { spec: linearOneStep, generateApply: linearOneStepApply },
  { spec: linearTwoStep, generateApply: linearTwoStepApply },
  { spec: linearBothSides, generateApply: linearBothSidesApply },
];

export function getSkillEntry(skillId: string): SkillEntry | undefined {
  return SKILLS.find((s) => s.spec.id === skillId);
}
