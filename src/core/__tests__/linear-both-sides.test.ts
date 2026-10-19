import { asFraction } from "../answer";
import { describe, expect, it } from "vitest";
import { add, div, equals, frac, mul, type Fraction } from "../fraction";
import { createRng } from "../rng";
import { linearBothSides, makeInstance } from "../skills/linear-both-sides";
import type { Instance } from "../types";

const SEEDS = Array.from({ length: 1000 }, (_, i) => i + 1);
const generate = (seed: number) => {
  const inst = linearBothSides.generate(createRng(seed));
  return { ...inst, answer: asFraction(inst.answer) };
};
const mistake = (id: string) => {
  const m = linearBothSides.mistakes.find((x) => x.id === id);
  if (!m) throw new Error(`no mistake ${id}`);
  return m;
};
const lines = (trace: { text: string }[]) => trace.map((l) => l.text);

describe("linear-both-sides: worked example 4x − 3 = 2x + 7", () => {
  const inst = makeInstance({ a: 4, b: -3, c: 2, d: 7 }, 0);

  it("has the right text and answer", () => {
    expect(inst.text).toBe("4x − 3 = 2x + 7");
    expect(inst.skillId).toBe("alg.linear.both-sides");
    expect(inst.version).toBe("1.0.0");
    expect(inst.answer).toEqual(frac(5));
  });

  it("solves with exactly the 5-line correct trace", () => {
    const { trace, answer } = linearBothSides.solve(inst);
    expect(lines(trace)).toEqual([
      "4x − 3 = 2x + 7",
      "4x − 2x − 3 = 7",
      "4x − 2x = 7 + 3",
      "2x = 10",
      "x = 5",
    ]);
    expect(answer).toEqual(frac(5));
  });

  it.each([
    ["kept-x-sign", frac(5, 3), 2, "4x + 2x − 3 = 7"],
    ["dropped-constant", frac(7, 2), 3, "4x − 2x = 7"],
    ["kept-const-sign", frac(2), 3, "4x − 2x = 7 − 3"],
    ["forgot-to-divide", frac(10), 5, "x = 10"],
  ] as const)("%s gives %o with first wrong line L%i", (id, answer, line, text) => {
    const out = mistake(id).apply(inst);
    expect(out.answer).toEqual(answer);
    expect(out.firstWrongLine).toBe(line);
    expect(out.trace[line - 1].text).toBe(text);
  });

  it("has exactly the 4 authored mistakes (no divide-by-a: left for the Miner)", () => {
    expect(linearBothSides.mistakes.map((m) => m.id).sort()).toEqual([
      "dropped-constant",
      "forgot-to-divide",
      "kept-const-sign",
      "kept-x-sign",
    ]);
    for (const m of linearBothSides.mistakes) {
      expect(equals(asFraction(m.apply(inst).answer), frac(5, 2))).toBe(false);
      expect(m.origin).toBe("authored");
    }
  });

  it("prints coefficient 1 as x and −1 as −x", () => {
    expect(makeInstance({ a: 1, b: 2, c: -1, d: 8 }, 0).text).toBe("x + 2 = −x + 8");
    const neg = makeInstance({ a: -1, b: -5, c: 3, d: 7 }, 0);
    expect(neg.text).toBe("−x − 5 = 3x + 7");
    expect(lines(linearBothSides.solve(neg).trace)[1]).toBe("−x − 3x − 5 = 7");
  });

  it("prints negative and fractional answers nicely", () => {
    // 3x + 2 = −2x − 5 → 5x = −7 → x = −7/5
    const t = lines(linearBothSides.solve(makeInstance({ a: 3, b: 2, c: -2, d: -5 }, 0)).trace);
    expect(t).toEqual(["3x + 2 = −2x − 5", "3x + 2x + 2 = −5", "3x + 2x = −5 − 2", "5x = −7", "x = −7/5"]);
  });
});

describe("linear-both-sides: spec", () => {
  it("has the id, version, rules and a 4-level hint ladder", () => {
    expect(linearBothSides.id).toBe("alg.linear.both-sides");
    expect(linearBothSides.version).toBe("1.0.0");
    expect(linearBothSides.hintLadder).toHaveLength(4);
    expect(linearBothSides.teachRule).toEqual({ traces: 3, distinctMistakesMin: 2, triesMax: 2 });
    expect(linearBothSides.proofRule).toEqual({ solve: 3, apply: 1, allCorrect: true });
  });

  it("child-facing text uses NCERT language (no 'move', no 'change the sign')", () => {
    const childText = [...linearBothSides.hintLadder, ...linearBothSides.mistakes.map((m) => m.childLabel)];
    for (const t of childText) {
      expect(t.toLowerCase()).not.toMatch(/\bmov(e|es|ed|ing)\b/);
      expect(t.toLowerCase()).not.toMatch(/change (the|its) sign/);
    }
  });
});

describe("linear-both-sides: property tests over 1,000 seeds", () => {
  const value = (coef: number, k: number, x: Fraction) => add(mul(frac(coef), x), frac(k));

  it("every generator rule holds", () => {
    for (const seed of SEEDS) {
      const inst = generate(seed);
      const { a, b, c, d } = inst.params;
      for (const v of [a, b, c, d]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).not.toBe(0);
        expect(Math.abs(v)).toBeLessThanOrEqual(12);
      }
      expect(a).not.toBe(c);
      expect(b).not.toBe(d);
      expect(a + c).not.toBe(0);
      expect(Math.abs(a - c)).not.toBe(1);
      expect(inst.answer.den).toBe(1);
      expect(inst.answer.num).not.toBe(0);
      expect(Math.abs(inst.answer.num)).toBeLessThanOrEqual(12);
      expect([a, b, c, d]).not.toContain(inst.answer.num);
      expect(equals(inst.answer, div(frac(d - b), frac(a - c)))).toBe(true);
    }
  });

  it("substituting the answer makes both sides equal", () => {
    for (const seed of SEEDS) {
      const { params: p, answer } = generate(seed);
      expect(equals(value(p.a, p.b, answer), value(p.c, p.d, answer))).toBe(true);
    }
  });

  it("solve() returns the answer and a 5-line trace starting with the question", () => {
    for (const seed of SEEDS) {
      const inst = generate(seed);
      const { trace, answer } = linearBothSides.solve(inst);
      expect(equals(asFraction(answer), inst.answer)).toBe(true);
      expect(trace).toHaveLength(5);
      expect(trace[0].text).toBe(inst.text);
    }
  });

  it("no mistake ever returns the correct answer, and all mistake answers are distinct", () => {
    for (const seed of SEEDS) {
      const inst = generate(seed);
      const answers = linearBothSides.mistakes.map((m) => asFraction(m.apply(inst).answer));
      for (const ans of answers) expect(equals(ans, inst.answer)).toBe(false);
      for (let i = 0; i < answers.length; i++)
        for (let j = i + 1; j < answers.length; j++) expect(equals(answers[i], answers[j])).toBe(false);
    }
  });

  it("each mistake's firstWrongLine is the first line that differs from the correct trace", () => {
    for (const seed of SEEDS) {
      const inst = generate(seed);
      const correct = lines(linearBothSides.solve(inst).trace);
      for (const m of linearBothSides.mistakes) {
        const out = m.apply(inst);
        const first = lines(out.trace).findIndex((t, i) => t !== correct[i]) + 1;
        expect(first, `${m.id} seed ${seed}`).toBeGreaterThan(0);
        expect(out.firstWrongLine, `${m.id} seed ${seed}`).toBe(first);
      }
    }
  });

  it("the same seed gives the same question", () => {
    for (const seed of SEEDS) {
      const one: Instance = generate(seed);
      expect(generate(seed)).toEqual(one);
      expect(one.seed).toBe(seed);
    }
  });

  it("hints never contain the answer", () => {
    for (const seed of SEEDS) {
      const ans = String(Math.abs(generate(seed).answer.num));
      for (const hint of linearBothSides.hintLadder) {
        expect(hint).not.toMatch(new RegExp(`x = [−-]?${ans}(?!\\d)`));
      }
    }
  });
});
