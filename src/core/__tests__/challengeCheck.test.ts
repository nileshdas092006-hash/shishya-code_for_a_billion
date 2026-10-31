import { describe, expect, it } from "vitest";
import { answerText } from "../answer";
import { CHECK_PLANS, checkKey, checkQuestion, checkSeeds, nextCheckSeed, scoreCheck } from "../challengeCheck";
import { createRng } from "../rng";
import { SKILLS } from "../skills";

// F11 Part 2. The Shishya Challenge's before / after / later checks: questions made from seeds by the skills'
// own generators, scored again from those seeds (stored answers are never trusted). The after check has the
// same mix as the before check and never the same numbers; the later (delayed) check is shorter.

const ONE = "alg.linear.one-step";
const TWO = "alg.linear.two-step";
const BOTH = "alg.linear.both-sides";

describe("the check plans", () => {
  it("before and after: 2 one-step, 2 two-step, 2 'x on both sides'; later: 1, 1, 2", () => {
    expect(CHECK_PLANS.pre).toEqual([ONE, ONE, TWO, TWO, BOTH, BOTH]);
    expect(CHECK_PLANS.post).toEqual(CHECK_PLANS.pre);
    expect(CHECK_PLANS.delayed).toEqual([ONE, TWO, BOTH, BOTH]);
    for (const id of new Set(Object.values(CHECK_PLANS).flat())) expect(SKILLS.map((s) => s.spec.id)).toContain(id);
  });

  it("a question is fully made by its skill and seed (the skill's own generator)", () => {
    for (const skillId of [ONE, TWO, BOTH]) {
      const spec = SKILLS.find((s) => s.spec.id === skillId)!.spec;
      expect(checkQuestion(skillId, 12345)).toEqual(spec.generate(createRng(12345)));
    }
    expect(() => checkQuestion("alg.nope", 1)).toThrow();
  });
});

describe("check seeds, over 1,000 random checks", () => {
  it("follow the plan, are all different, and the after check never repeats a question of the before check", () => {
    for (let s = 1; s <= 1000; s++) {
      const pre = checkSeeds(createRng(s), "pre", new Set());
      expect(pre).toHaveLength(6);
      const preKeys = pre.map((seed, i) => checkKey(CHECK_PLANS.pre[i], checkQuestion(CHECK_PLANS.pre[i], seed).params));
      expect(new Set(preKeys).size).toBe(6);

      const post = checkSeeds(createRng(s * 7919), "post", new Set(preKeys));
      const postKeys = post.map((seed, i) => checkKey(CHECK_PLANS.post[i], checkQuestion(CHECK_PLANS.post[i], seed).params));
      expect(new Set(postKeys).size).toBe(6);
      expect(postKeys.filter((k) => preKeys.includes(k))).toEqual([]);
      expect(post.filter((seed) => pre.includes(seed))).toEqual([]);

      const delayed = checkSeeds(createRng(s * 104729), "delayed", new Set([...preKeys, ...postKeys]));
      const delayedKeys = delayed.map((seed, i) => checkKey(CHECK_PLANS.delayed[i], checkQuestion(CHECK_PLANS.delayed[i], seed).params));
      expect(delayed).toHaveLength(4);
      expect(new Set(delayedKeys).size).toBe(4);
      expect(delayedKeys.filter((k) => preKeys.includes(k) || postKeys.includes(k))).toEqual([]);
    }
  });

  it("are the same for the same seeded random generator, and use nothing else", () => {
    expect(checkSeeds(createRng(42), "pre", new Set())).toEqual(checkSeeds(createRng(42), "pre", new Set()));
    expect(checkSeeds(createRng(42), "pre", new Set())).not.toEqual(checkSeeds(createRng(43), "pre", new Set()));
  });

  it("nextCheckSeed skips a question to avoid, and gives up (an error) rather than repeat one", () => {
    const rng = createRng(9);
    const first = nextCheckSeed(createRng(9), BOTH, new Set());
    const avoid = new Set([checkKey(BOTH, checkQuestion(BOTH, first).params)]);
    const second = nextCheckSeed(rng, BOTH, avoid);
    expect(checkKey(BOTH, checkQuestion(BOTH, second).params)).not.toBe([...avoid][0]);
    const everything = { has: () => true } as unknown as ReadonlySet<string>;
    expect(() => nextCheckSeed(createRng(1), ONE, everything)).toThrow();
  });
});

describe("scoring a check again from its seeds", () => {
  const plan = CHECK_PLANS.pre;
  const seeds = checkSeeds(createRng(2026), "pre", new Set());
  const items = (answers: (string | null)[]) =>
    plan.map((skillId, i) => {
      const q = checkQuestion(skillId, seeds[i]);
      return { skillId, seed: seeds[i], paramsJson: JSON.stringify(q.params), answer: answers[i] };
    });
  const right = plan.map((skillId, i) => answerText(checkQuestion(skillId, seeds[i]).answer));

  it("counts the right answers, in any form the forgiving parser reads", () => {
    expect(scoreCheck(items(right))).toBe(6);
    expect(scoreCheck(items(right.map((a) => `x = ${a}`)))).toBe(6);
    expect(scoreCheck(items(right.map((a, i) => (i % 2 ? a : `${a}1`))))).toBe(3);
  });

  it("over 1,000 random checks: all right is 6, each wrong or missing answer takes one away", () => {
    for (let s = 1; s <= 1000; s++) {
      const sd = checkSeeds(createRng(s), "pre", new Set());
      const qs = plan.map((skillId, i) => checkQuestion(skillId, sd[i]));
      const wrong = s % 7; // 0–6 answers made wrong or left out
      const answers = qs.map((q, i) => (i < wrong ? (i % 2 ? null : `${answerText(q.answer)}9`) : answerText(q.answer)));
      const rows = plan.map((skillId, i) => ({ skillId, seed: sd[i], paramsJson: JSON.stringify(qs[i].params), answer: answers[i] }));
      expect(scoreCheck(rows)).toBe(6 - Math.min(wrong, 6));
    }
  });

  it("never trusts stored data: a question whose numbers do not match its seed, an unknown skill or an unreadable answer scores 0", () => {
    const rows = items(right);
    rows[0] = { ...rows[0], paramsJson: JSON.stringify({ a: 1, b: 2, d: 3 }) };
    rows[1] = { ...rows[1], skillId: "alg.nope" };
    rows[2] = { ...rows[2], answer: "x = = 3" };
    rows[3] = { ...rows[3], answer: "" };
    expect(scoreCheck(rows)).toBe(2);
  });
});
