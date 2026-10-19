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

describe("the 5-skill chain", () => {
  it("lists the skills in teaching order, each needing the one before", () => {
    const ids = SKILLS.map((s) => s.spec.id);
    expect(ids).toEqual(["alg.integers.ops", "alg.like-terms", "alg.linear.one-step", "alg.linear.two-step", "alg.linear.both-sides"]);
    SKILLS.forEach((s, i) => expect(s.spec.prerequisites).toEqual(i === 0 ? [] : [ids[i - 1]]));
  });
});
