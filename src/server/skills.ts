import { createRng, type Rng } from "../core/rng";
import { linearBothSides } from "../core/skills/linear-both-sides";
import { generateApply, type ApplyItem } from "../core/skills/linear-both-sides-apply";
import type { Instance, SkillSpec } from "../core/types";

// Which skills the server knows about. A skill = its spec (questions, solver, mistakes) + its word-problem generator.

export type SkillEntry = { spec: SkillSpec; generateApply: (rng: Rng) => ApplyItem };
export type Registry = Record<string, SkillEntry>;

export const defaultRegistry: Registry = {
  [linearBothSides.id]: { spec: linearBothSides, generateApply },
};

/** Re-creates an item's question from its seed, so stored answers are never trusted blindly. */
export function instanceFor(entry: SkillEntry, item: { seed: number; format: "solve" | "apply" }): Instance {
  return item.format === "apply"
    ? entry.generateApply(createRng(item.seed)).instance
    : entry.spec.generate(createRng(item.seed));
}

export function getEntry(registry: Registry, skillId: string): SkillEntry {
  const entry = registry[skillId];
  if (!entry) throw new Error(`Unknown skill: ${skillId}`);
  return entry;
}
