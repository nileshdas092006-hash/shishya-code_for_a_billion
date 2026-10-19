import { describe, expect, it } from "vitest";
import { answerText } from "../answer";
import { createRng } from "../rng";
import { getSkillEntry } from "../skills";
import { integersOps, makeIntegersInstance } from "../skills/integers-ops";
import { applies } from "../types";
import { describeSkillProperties } from "./skill-properties";

const lines = (t: { text: string }[]) => t.map((l) => l.text);
const mistake = (id: string) => integersOps.mistakes.find((m) => m.id === id)!;
const ADD = 0;
const SUB = 1;

describe("alg.integers.ops: worked examples", () => {
  it("−7 + 3: subtract the sizes, keep the sign of the larger", () => {
    const inst = makeIntegersInstance({ a: -7, b: 3, op: ADD }, 0);
    expect(inst.text).toBe("−7 + 3");
    expect(lines(integersOps.solve(inst).trace)).toEqual(["−7 + 3", "−(7 − 3)", "−4"]);
    expect(answerText(inst.answer)).toBe("-4");
    const out = mistake("ignores-sign").apply(inst);
    expect([lines(out.trace), answerText(out.answer), out.firstWrongLine]).toEqual([["−7 + 3", "7 + 3", "10"], "10", 2]);
    expect(applies(mistake("minus-negative-as-minus"), inst)).toBe(false);
    expect(applies(mistake("sign-of-first"), inst)).toBe(false); // −7 is the larger size, so its sign is right anyway
  });

  it("5 − (−4): subtracting a negative is adding its opposite", () => {
    const inst = makeIntegersInstance({ a: 5, b: -4, op: SUB }, 0);
    expect(inst.text).toBe("5 − (−4)");
    expect(lines(integersOps.solve(inst).trace)).toEqual(["5 − (−4)", "5 + 4", "9"]);
    const out = mistake("minus-negative-as-minus").apply(inst);
    expect([lines(out.trace), answerText(out.answer), out.firstWrongLine]).toEqual([["5 − (−4)", "5 − 4", "1"], "1", 2]);
    expect(applies(mistake("ignores-sign"), inst)).toBe(false); // 5 + 4: no negative left to ignore
  });

  it("3 + (−7): the sign of the larger size, not the sign of the first number", () => {
    const inst = makeIntegersInstance({ a: 3, b: -7, op: ADD }, 0);
    expect(lines(integersOps.solve(inst).trace)).toEqual(["3 + (−7)", "−(7 − 3)", "−4"]);
    const out = mistake("sign-of-first").apply(inst);
    expect([lines(out.trace), answerText(out.answer), out.firstWrongLine]).toEqual([["3 + (−7)", "7 − 3", "4"], "4", 2]);
  });

  it("−4 − (−9): every mistake applies, and each gives a different wrong answer", () => {
    const inst = makeIntegersInstance({ a: -4, b: -9, op: SUB }, 0);
    expect(lines(integersOps.solve(inst).trace)).toEqual(["−4 − (−9)", "−4 + 9", "9 − 4", "5"]);
    expect(answerText(mistake("minus-negative-as-minus").apply(inst).answer)).toBe("-13");
    expect(answerText(mistake("ignores-sign").apply(inst).answer)).toBe("13");
    expect(answerText(mistake("sign-of-first").apply(inst).answer)).toBe("-5");
  });

  it("−7 − 3: write the subtraction as adding the opposite first", () => {
    const inst = makeIntegersInstance({ a: -7, b: 3, op: SUB }, 0);
    expect(lines(integersOps.solve(inst).trace)).toEqual(["−7 − 3", "−7 + (−3)", "−(7 + 3)", "−10"]);
  });

  it("generator rules: whole numbers −12…12, never 0, at least one negative, different sizes, answer not 0", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const { a, b, op } = integersOps.generate(createRng(seed)).params;
      for (const v of [a, b]) expect(v !== 0 && Math.abs(v) <= 12 && Number.isInteger(v)).toBe(true);
      expect([0, 1]).toContain(op);
      expect(a < 0 || b < 0).toBe(true);
      expect(Math.abs(a)).not.toBe(Math.abs(b));
      expect(op === ADD ? a + b : a - b).not.toBe(0);
    }
  });

  it("is first in the chain", () => {
    expect(integersOps.prerequisites).toEqual([]);
  });
});

describeSkillProperties(getSkillEntry("alg.integers.ops")!, { leak: (ans) => new RegExp(`= [−-]?${answerText(ans).replace("-", "")}(?!\\d)`) });
