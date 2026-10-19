import { describe, expect, it } from "vitest";
import { answerText } from "../answer";
import { createRng } from "../rng";
import { getSkillEntry } from "../skills";
import { likeTerms, makeLikeTermsInstance } from "../skills/like-terms";
import { applies } from "../types";
import { describeSkillProperties } from "./skill-properties";

const lines = (t: { text: string }[]) => t.map((l) => l.text);
const mistake = (id: string) => likeTerms.mistakes.find((m) => m.id === id)!;

describe("alg.like-terms: worked example 3x + 5 − x + 2", () => {
  const inst = makeLikeTermsInstance({ a: 3, b: 5, c: -1, d: 2 }, 0);

  it("groups like terms, then adds them: 2x + 7 (an expression answer)", () => {
    expect(inst.text).toBe("3x + 5 − x + 2");
    expect(lines(likeTerms.solve(inst).trace)).toEqual(["3x + 5 − x + 2", "3x − x + 5 + 2", "2x + 7"]);
    expect(answerText(inst.answer)).toBe("2x + 7");
    expect(likeTerms.answerKind).toBe("expression");
  });

  it.each([
    ["added-all-together", ["3x + 5 − x + 2", "3x − x + 5 + 2", "9x"], "9x", 3],
    ["dropped-sign", ["3x + 5 − x + 2", "3x + x + 5 + 2", "4x + 7"], "4x + 7", 2],
    ["x-as-0x", ["3x + 5 − x + 2", "3x + 0x + 5 + 2", "3x + 7"], "3x + 7", 2],
  ] as const)("%s", (id, trace, answer, line) => {
    expect(applies(mistake(id), inst)).toBe(true);
    const out = mistake(id).apply(inst);
    expect(lines(out.trace)).toEqual(trace);
    expect(answerText(out.answer)).toBe(answer);
    expect(out.firstWrongLine).toBe(line);
  });

  it("x-as-0x needs an x or −x term, and dropped-sign needs a negative term", () => {
    const noOnes = makeLikeTermsInstance({ a: 4, b: 5, c: 2, d: 3 }, 0);
    expect(applies(mistake("x-as-0x"), noOnes)).toBe(false);
    expect(applies(mistake("dropped-sign"), noOnes)).toBe(false);
  });

  it("generator rules: x-terms −9…9, numbers −12…12, none 0; the answer has an x-term and a number", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const { a, b, c, d } = likeTerms.generate(createRng(seed)).params;
      for (const v of [a, c]) expect(v !== 0 && Math.abs(v) <= 9).toBe(true);
      for (const v of [b, d]) expect(v !== 0 && Math.abs(v) <= 12).toBe(true);
      expect(a + c).not.toBe(0);
      expect(b + d).not.toBe(0);
    }
  });

  it("comes after integers", () => {
    expect(likeTerms.prerequisites).toEqual(["alg.integers.ops"]);
  });
});

describeSkillProperties(getSkillEntry("alg.like-terms")!, { leak: (ans) => new RegExp(answerText(ans).replace(/[+]/g, "\\+")) });
