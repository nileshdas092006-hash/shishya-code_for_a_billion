import { describe, expect, it } from "vitest";
import { answerText } from "../answer";
import { createRng } from "../rng";
import { getSkillEntry } from "../skills";
import { linearTwoStep, makeTwoStepInstance } from "../skills/linear-two-step";
import { describeSkillProperties } from "./skill-properties";

const lines = (t: { text: string }[]) => t.map((l) => l.text);
const mistake = (id: string) => linearTwoStep.mistakes.find((m) => m.id === id)!;

describe("alg.linear.two-step: worked example 5x − 3 = −8", () => {
  const inst = makeTwoStepInstance({ a: 5, b: -3, d: -8 }, 0);

  it("first remove the number, then divide", () => {
    expect(inst.text).toBe("5x − 3 = −8");
    expect(lines(linearTwoStep.solve(inst).trace)).toEqual(["5x − 3 = −8", "5x = −8 + 3", "5x = −5", "x = −1"]);
    expect(answerText(inst.answer)).toBe("-1");
  });

  it.each([
    ["divided-first", ["5x − 3 = −8", "x − 3 = −8/5", "x = 7/5"], "7/5", 2],
    ["kept-const-sign", ["5x − 3 = −8", "5x = −8 − 3", "5x = −11", "x = −11/5"], "-11/5", 2],
    ["forgot-to-divide", ["5x − 3 = −8", "5x = −8 + 3", "5x = −5", "x = −5"], "-5", 4],
  ] as const)("%s", (id, trace, answer, line) => {
    const out = mistake(id).apply(inst);
    expect(lines(out.trace)).toEqual(trace);
    expect(answerText(out.answer)).toBe(answer);
    expect(out.firstWrongLine).toBe(line);
  });

  it("generator rules: a·x + b = d with a not 0 or ±1, b not 0, a whole-number answer −12…12, not 0", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const { a, b, d } = linearTwoStep.generate(createRng(seed)).params;
      expect(Math.abs(a)).toBeGreaterThan(1);
      expect(Math.abs(a)).toBeLessThanOrEqual(9);
      expect(b).not.toBe(0);
      const x = (d - b) / a;
      expect(Number.isInteger(x) && x !== 0 && Math.abs(x) <= 12).toBe(true);
    }
  });

  it("comes after one-step equations, and leads to variables on both sides", () => {
    expect(linearTwoStep.prerequisites).toEqual(["alg.linear.one-step"]);
    expect(getSkillEntry("alg.linear.both-sides")!.spec.prerequisites).toEqual(["alg.linear.two-step"]);
  });
});

describeSkillProperties(getSkillEntry("alg.linear.two-step")!, { leak: (ans) => new RegExp(`x = [−-]?${answerText(ans).replace("-", "")}(?![\\d/])`) });
