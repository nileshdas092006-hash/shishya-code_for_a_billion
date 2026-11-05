import { describe, expect, it } from "vitest";
import { answerText } from "../answer";
import { CHECK_PLANS, checkKey, checkQuestion, checkSeeds, DET, DICE, PACK_CHECK_PLANS, scoreCheck } from "../challengeCheck";
import { createRng } from "../rng";
import { COLLEGE_SKILLS, SKILLS } from "../skills";

// F12 Part 2. A check has a plan per pack. The school plans are the F11 ones, unchanged; the college pack checks
// the two college skills, with the same rules: all new questions, scored again from their seeds.

const keysOf = (phase: "pre" | "post" | "delayed", seeds: number[]) => {
  const plan = PACK_CHECK_PLANS.college[phase];
  return seeds.map((seed, i) => checkKey(plan[i], checkQuestion(plan[i], seed).params));
};

describe("the check plans per pack", () => {
  it("school: exactly the F11 plans, still exported as CHECK_PLANS", () => {
    expect(PACK_CHECK_PLANS.school).toBe(CHECK_PLANS);
    expect(CHECK_PLANS.pre).toEqual(["alg.linear.one-step", "alg.linear.one-step", "alg.linear.two-step", "alg.linear.two-step", "alg.linear.both-sides", "alg.linear.both-sides"]);
    for (const phase of ["pre", "post", "delayed"] as const) {
      for (const id of CHECK_PLANS[phase]) expect(SKILLS.map((s) => s.spec.id)).toContain(id);
    }
  });

  it("college: pre and post 3 determinants + 3 dice; delayed 2 + 2; only college skills", () => {
    expect(DET).toBe("col.matrix.det2");
    expect(DICE).toBe("col.prob.two-dice");
    expect(PACK_CHECK_PLANS.college.pre).toEqual([DET, DET, DET, DICE, DICE, DICE]);
    expect(PACK_CHECK_PLANS.college.post).toEqual([DET, DET, DET, DICE, DICE, DICE]);
    expect(PACK_CHECK_PLANS.college.delayed).toEqual([DET, DET, DICE, DICE]);
    for (const phase of ["pre", "post", "delayed"] as const) {
      for (const id of PACK_CHECK_PLANS.college[phase]) expect(COLLEGE_SKILLS.map((s) => s.spec.id)).toContain(id);
    }
  });
});

describe("college check seeds, over 1,000 random checks", () => {
  it("follow the plan, are all different, and never repeat a question from an earlier check (only 27 dice questions exist)", () => {
    for (let s = 1; s <= 1000; s++) {
      const pre = keysOf("pre", checkSeeds(createRng(s), "pre", new Set(), "college"));
      expect(new Set(pre).size).toBe(6);
      const post = keysOf("post", checkSeeds(createRng(s * 7919), "post", new Set(pre), "college"));
      expect(new Set(post).size).toBe(6);
      expect(post.filter((k) => pre.includes(k))).toEqual([]);
      const delayed = keysOf("delayed", checkSeeds(createRng(s * 104729), "delayed", new Set([...pre, ...post]), "college"));
      expect(new Set(delayed).size).toBe(4);
      expect(delayed.filter((k) => pre.includes(k) || post.includes(k))).toEqual([]);
    }
  });

  it("the pack is optional: with none, the school plan as before", () => {
    expect(checkSeeds(createRng(42), "pre", new Set())).toEqual(checkSeeds(createRng(42), "pre", new Set(), "school"));
  });

  it("score the same way: all right is 6, each wrong or missing answer takes one away", () => {
    const plan = PACK_CHECK_PLANS.college.pre;
    for (let s = 1; s <= 1000; s++) {
      const seeds = checkSeeds(createRng(s), "pre", new Set(), "college");
      const qs = plan.map((skillId, i) => checkQuestion(skillId, seeds[i]));
      const wrong = s % 7;
      const items = plan.map((skillId, i) => ({
        skillId,
        seed: seeds[i],
        paramsJson: JSON.stringify(qs[i].params),
        answer: i < wrong ? (i % 2 ? null : `${answerText(qs[i].answer)}9`) : answerText(qs[i].answer),
      }));
      expect(scoreCheck(items)).toBe(6 - wrong);
    }
  });
});
