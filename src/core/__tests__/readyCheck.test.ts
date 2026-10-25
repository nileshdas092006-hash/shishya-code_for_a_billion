import { describe, expect, it } from "vitest";
import { parseAnswer, sameAnswer } from "../answer";
import { createRng } from "../rng";
import {
  READY_CHECK_ID,
  READY_CHECK_PASS,
  READY_CHECK_PLAN,
  readyCheckPassed,
  readyCheckSeeds,
  readyOpOf,
  readyQuestion,
} from "../readyCheck";
import { SKILLS } from "../skills";

// P1d. The Ready check: 6 quick whole-number questions before the first skill (2 addition, 2 subtraction,
// 2 multiplication, sizes like Class 5–6). Each question is fully determined by its own seed, so the server can
// always re-create it. It is NOT a skill of the mastery chain.

const MINUS = "−";

describe("the Ready check generator", () => {
  it("is 2 addition, 2 subtraction and 2 multiplication questions, and needs 5 of 6 right", () => {
    expect(READY_CHECK_PLAN).toEqual(["add", "add", "sub", "sub", "mul", "mul"]);
    expect(READY_CHECK_PASS).toBe(5);
    expect([6, 5, 4, 0].map(readyCheckPassed)).toEqual([true, true, false, false]);
  });

  it("is deterministic: the same seeds give the same 6 questions, a seed always gives the same question", () => {
    const a = readyCheckSeeds(createRng(42));
    expect(readyCheckSeeds(createRng(42))).toEqual(a);
    expect(readyCheckSeeds(createRng(43))).not.toEqual(a);
    for (const seed of a) expect(readyQuestion(seed)).toEqual(readyQuestion(seed));
    expect(a.map(readyOpOf)).toEqual([...READY_CHECK_PLAN]);
  });

  it("over 1,000 random checks: the plan's operations, Class 5–6 sizes, whole-number answers, all different questions", () => {
    const rng = createRng(20261025);
    for (let n = 0; n < 1000; n++) {
      const seeds = readyCheckSeeds(rng);
      expect(seeds).toHaveLength(6);
      const qs = seeds.map(readyQuestion);
      expect(new Set(qs.map((q) => q.text)).size).toBe(6);
      for (const [i, q] of qs.entries()) {
        expect(Number.isInteger(seeds[i]) && seeds[i] >= 1 && seeds[i] < 2 ** 31).toBe(true);
        expect(q.skillId).toBe(READY_CHECK_ID);
        expect(q.seed).toBe(seeds[i]);
        const { a, b } = q.params;
        const op = READY_CHECK_PLAN[i];
        expect(readyOpOf(seeds[i])).toBe(op);
        const value = op === "add" ? a + b : op === "sub" ? a - b : a * b;
        expect(q.answer).toEqual({ num: value, den: 1 });
        expect(value).toBeGreaterThan(0);
        if (op === "add") {
          expect(a >= 100 && a <= 9999 && b >= 100 && b <= 999).toBe(true);
          expect(q.text).toBe(`${a} + ${b}`);
        } else if (op === "sub") {
          expect(a >= 1000 && a <= 9999 && b >= 100 && b <= 999 && a > b).toBe(true);
          expect(q.text).toBe(`${a} ${MINUS} ${b}`);
        } else {
          expect(a >= 12 && a <= 99 && b >= 11 && b <= 99).toBe(true);
          expect(q.text).toBe(`${a} × ${b}`);
        }
        // the child's typed answer is read by the same parser as every other answer
        const typed = parseAnswer(String(value));
        expect(typed.ok && sameAnswer(typed.value, q.answer)).toBe(true);
      }
    }
  });

  it("is not a skill: it is never in the mastery chain", () => {
    expect(SKILLS.map((s) => s.spec.id)).not.toContain(READY_CHECK_ID);
    for (const { spec } of SKILLS) expect(spec.prerequisites).not.toContain(READY_CHECK_ID);
  });
});
