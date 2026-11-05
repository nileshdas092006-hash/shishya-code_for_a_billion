import { describe, expect, it } from "vitest";
import { ALL_SKILLS, COLLEGE_SKILLS, getSkillEntry, packOf, SKILLS, skillsForPack } from "../skills";

// F12 Part 1. Every skill belongs to a pack. SKILLS stays the school chain (the classroom, the tour, the projector
// and the school challenge all read it); the college skills are found by id, but are in no school list.

const COLLEGE = ["col.matrix.det2", "col.prob.two-dice"];
const SCHOOL = ["alg.integers.ops", "alg.like-terms", "alg.linear.one-step", "alg.linear.two-step", "alg.linear.both-sides"];

describe("skill packs", () => {
  it("every existing skill is school, and SKILLS is exactly the school chain", () => {
    expect(SKILLS.map((s) => s.spec.id)).toEqual(SCHOOL);
    for (const s of SKILLS) {
      expect(s.pack).toBe("school");
      expect(packOf(s)).toBe("school");
    }
    expect(skillsForPack("school")).toBe(SKILLS);
  });

  it("the two college skills are college, and are not in the school chain", () => {
    expect(COLLEGE_SKILLS.map((s) => s.spec.id)).toEqual(COLLEGE);
    for (const s of COLLEGE_SKILLS) expect(s.pack).toBe("college");
    expect(skillsForPack("college")).toBe(COLLEGE_SKILLS);
    for (const id of COLLEGE) expect(SKILLS.map((s) => s.spec.id)).not.toContain(id);
  });

  it("a skill is found by id whichever pack it is in, each once", () => {
    for (const id of [...SCHOOL, ...COLLEGE]) expect(getSkillEntry(id)?.spec.id).toBe(id);
    const ids = ALL_SKILLS.map((s) => s.spec.id);
    expect(ids).toEqual([...SCHOOL, ...COLLEGE]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("an entry with no pack (a test's own skill) counts as school", () => {
    const { spec, generateApply } = SKILLS[0];
    expect(packOf({ spec, generateApply })).toBe("school");
  });
});
