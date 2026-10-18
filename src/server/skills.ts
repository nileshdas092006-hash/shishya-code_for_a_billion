import { createRng } from "../core/rng";
import { SKILLS, type SkillEntry } from "../core/skills";
import type { Instance } from "../core/types";

// Which skills the server knows about: always built from the core registry (src/core/skills/index.ts).

export type { SkillEntry } from "../core/skills";
export type Registry = Record<string, SkillEntry>;

export const defaultRegistry: Registry = Object.fromEntries(SKILLS.map((s) => [s.spec.id, s]));

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
