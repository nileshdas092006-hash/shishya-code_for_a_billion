import type { Rng } from "../rng";
import type { ApplyItem, Pack, SkillSpec } from "../types";
import { colMatrixDet2, colMatrixDet2Apply } from "./col-matrix-det2";
import { colProbTwoDice, colProbTwoDiceApply } from "./col-prob-two-dice";
import { integersOps, integersOpsApply } from "./integers-ops";
import { likeTerms, likeTermsApply } from "./like-terms";
import { linearBothSides } from "./linear-both-sides";
import { generateApply as linearBothSidesApply } from "./linear-both-sides-apply";
import { linearOneStep, linearOneStepApply } from "./linear-one-step";
import { linearTwoStep, linearTwoStepApply } from "./linear-two-step";

// Every skill Shishya knows. Screens and the server read skills ONLY from here, and must not assume there is just one.
// SKILLS is the school pack, in teaching order (each needs the one before); COLLEGE_SKILLS is the college pack (F12:
// no prerequisites). A class has one pack, and its students only ever see that pack's skills.

/** pack: an entry with none (a test's own skill) counts as school, see packOf. */
export type SkillEntry = { spec: SkillSpec; generateApply: (rng: Rng) => ApplyItem; pack?: Pack };

export const SKILLS: readonly SkillEntry[] = [
  { spec: integersOps, generateApply: integersOpsApply, pack: "school" },
  { spec: likeTerms, generateApply: likeTermsApply, pack: "school" },
  { spec: linearOneStep, generateApply: linearOneStepApply, pack: "school" },
  { spec: linearTwoStep, generateApply: linearTwoStepApply, pack: "school" },
  { spec: linearBothSides, generateApply: linearBothSidesApply, pack: "school" },
];

export const COLLEGE_SKILLS: readonly SkillEntry[] = [
  { spec: colMatrixDet2, generateApply: colMatrixDet2Apply, pack: "college" },
  { spec: colProbTwoDice, generateApply: colProbTwoDiceApply, pack: "college" },
];

export const ALL_SKILLS: readonly SkillEntry[] = [...SKILLS, ...COLLEGE_SKILLS];

export const packOf = (entry: SkillEntry): Pack => entry.pack ?? "school";

export const skillsForPack = (pack: Pack): readonly SkillEntry[] => (pack === "college" ? COLLEGE_SKILLS : SKILLS);

export function getSkillEntry(skillId: string): SkillEntry | undefined {
  return ALL_SKILLS.find((s) => s.spec.id === skillId);
}
