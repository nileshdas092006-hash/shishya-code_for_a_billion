import { describe, expect, it } from "vitest";
import { createRng } from "../rng";
import { getSkillEntry, SKILLS } from "../skills";

describe("skill registry", () => {
  it("lists every skill once, each with a word-problem generator", () => {
    const ids = SKILLS.map((s) => s.spec.id);
    expect(ids).toContain("alg.linear.both-sides");
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SKILLS) expect(s.generateApply(createRng(1)).instance.skillId).toBe(s.spec.id);
  });

  it("finds a skill by id, and returns undefined for an unknown id", () => {
    expect(getSkillEntry("alg.linear.both-sides")?.spec.id).toBe("alg.linear.both-sides");
    expect(getSkillEntry("no.such.skill")).toBeUndefined();
  });
});
