import { describe, expect, it } from "vitest";
import { answerText } from "../answer";
import { createRng } from "../rng";
import { getSkillEntry } from "../skills";
import { linearOneStep, makeOneStepInstance } from "../skills/linear-one-step";
import { applies } from "../types";
import { describeSkillProperties } from "./skill-properties";

const lines = (t: { text: string }[]) => t.map((l) => l.text);
const mistake = (id: string) => linearOneStep.mistakes.find((m) => m.id === id)!;
const run = (id: string, p: { a: number; b: number; d: number }) => {
  const out = mistake(id).apply(makeOneStepInstance(p, 0));
  return [lines(out.trace), answerText(out.answer), out.firstWrongLine];
};

describe("alg.linear.one-step: worked examples", () => {
  it("x + 7 = 3: subtract 7 from both sides", () => {
    const inst = makeOneStepInstance({ a: 1, b: 7, d: 3 }, 0);
    expect(inst.text).toBe("x + 7 = 3");
    expect(lines(linearOneStep.solve(inst).trace)).toEqual(["x + 7 = 3", "x + 7 − 7 = 3 − 7", "x = −4"]);
    expect(run("same-operation", { a: 1, b: 7, d: 3 })).toEqual([["x + 7 = 3", "x = 3 + 7", "x = 10"], "10", 2]);
    expect(run("sign-error", { a: 1, b: 7, d: 3 })).toEqual([["x + 7 = 3", "x + 7 − 7 = 3 − 7", "x = 4"], "4", 3]);
    expect(applies(mistake("divided-wrong-way"), inst)).toBe(false);
  });

  it("x − 5 = −2: add 5 to both sides", () => {
    const inst = makeOneStepInstance({ a: 1, b: -5, d: -2 }, 0);
    expect(inst.text).toBe("x − 5 = −2");
    expect(lines(linearOneStep.solve(inst).trace)).toEqual(["x − 5 = −2", "x − 5 + 5 = −2 + 5", "x = 3"]);
    expect(run("same-operation", { a: 1, b: -5, d: -2 })).toEqual([["x − 5 = −2", "x = −2 − 5", "x = −7"], "-7", 2]);
  });

  it("4x = −12: divide both sides by 4", () => {
    const inst = makeOneStepInstance({ a: 4, b: 0, d: -12 }, 0);
    expect(inst.text).toBe("4x = −12");
    expect(lines(linearOneStep.solve(inst).trace)).toEqual(["4x = −12", "x = −3"]);
    expect(run("same-operation", { a: 4, b: 0, d: -12 })).toEqual([["4x = −12", "x = −48"], "-48", 2]);
    expect(run("divided-wrong-way", { a: 4, b: 0, d: -12 })).toEqual([["4x = −12", "x = −1/3"], "-1/3", 2]);
    expect(run("sign-error", { a: 4, b: 0, d: -12 })).toEqual([["4x = −12", "x = 3"], "3", 2]);
  });

  it("generator rules: either x ± b = d or a·x = d (a not ±1); a whole-number answer from −12 to 12, not 0", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const inst = linearOneStep.generate(createRng(seed));
      const { a, b, d } = inst.params;
      if (a === 1) {
        expect(b).not.toBe(0);
        expect(Math.abs(b)).toBeLessThanOrEqual(9);
        expect(Math.abs(d)).toBeLessThanOrEqual(12);
      }
      else {
        expect(b).toBe(0);
        expect(Math.abs(a)).toBeGreaterThan(1);
      }
      const x = (d - b) / a;
      expect(Number.isInteger(x) && x !== 0 && Math.abs(x) <= 12).toBe(true);
    }
  });

  it("comes after like terms", () => {
    expect(linearOneStep.prerequisites).toEqual(["alg.like-terms"]);
  });
});

describeSkillProperties(getSkillEntry("alg.linear.one-step")!, { leak: (ans) => new RegExp(`x = [−-]?${answerText(ans).replace("-", "")}(?![\\d/])`) });
