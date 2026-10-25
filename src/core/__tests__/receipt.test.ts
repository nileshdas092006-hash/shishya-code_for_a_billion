import { describe, expect, it } from "vitest";
import { answerText } from "../answer";
import { frac } from "../fraction";
import { answerReceipt, lineReceipt, teachLineReceipt } from "../receipt";
import { createRng } from "../rng";
import { SKILLS } from "../skills";
import { makeIntegersInstance } from "../skills/integers-ops";
import { makeLikeTermsInstance } from "../skills/like-terms";
import { makeInstance as makeBothSides } from "../skills/linear-both-sides";
import { makeOneStepInstance } from "../skills/linear-one-step";
import { makeTwoStepInstance } from "../skills/linear-two-step";
import { applies } from "../types";

// Receipts: the short proof under every verdict ("put the answer back in"). They are data; screens translate them.

const SEEDS = Array.from({ length: 1000 }, (_, i) => i + 1);
const EQUATION_SKILLS = ["alg.linear.one-step", "alg.linear.two-step", "alg.linear.both-sides"];

describe("answerReceipt: examples", () => {
  it("substitutes the child's value into the original equation", () => {
    const inst = makeTwoStepInstance({ a: 3, b: 5, d: 26 }, 0);
    expect(answerReceipt(inst, frac(7))).toEqual({
      kind: "substitute",
      x: "7",
      left: "3×7 + 5 = 26",
      right: "26",
      leftValue: "26",
      rightValue: "26",
      holds: true,
    });
    expect(answerReceipt(inst, frac(6))).toMatchObject({ kind: "substitute", left: "3×6 + 5 = 23", right: "26", holds: false });
  });

  it("puts brackets round a negative or fractional value, and works out both sides when x is on both", () => {
    const inst = makeBothSides({ a: 4, b: -3, c: 2, d: 7 }, 0);
    expect(answerReceipt(inst, frac(5))).toMatchObject({ left: "4×5 − 3 = 17", right: "2×5 + 7 = 17", holds: true });
    expect(answerReceipt(inst, frac(-2))).toMatchObject({ x: "−2", left: "4×(−2) − 3 = −11", right: "2×(−2) + 7 = 3", holds: false });
    expect(answerReceipt(inst, frac(5, 3))).toMatchObject({ x: "5/3", left: "4×(5/3) − 3 = 11/3", holds: false });
    const oneStep = makeOneStepInstance({ a: 1, b: 7, d: 3 }, 0);
    expect(answerReceipt(oneStep, frac(-4))).toMatchObject({ left: "(−4) + 7 = 3", right: "3", holds: true });
  });

  it("integers: the sign rule used, and a check that undoes the addition", () => {
    const inst = makeIntegersInstance({ a: -7, b: 4, op: 0 }, 0);
    expect(answerReceipt(inst, frac(-3))).toEqual({
      kind: "integer",
      expr: "(−7) + 4",
      value: "−3",
      rule: "different-signs",
      check: "(−3) − 4 = −7",
      back: "−7",
      start: "−7",
      holds: true,
    });
    expect(answerReceipt(inst, frac(11))).toMatchObject({ value: "11", check: "11 − 4 = 7", back: "7", start: "−7", holds: false });
    const sub = makeIntegersInstance({ a: 5, b: -4, op: 1 }, 0);
    expect(answerReceipt(sub, frac(9))).toMatchObject({ expr: "5 + 4", rule: "same-signs", check: "9 − 4 = 5", holds: true });
  });

  it("like terms: the right answer shows the x-terms and the numbers added; a wrong one is compared at one value of x", () => {
    const inst = makeLikeTermsInstance({ a: 3, b: 4, c: 2, d: -1 }, 0);
    expect(answerReceipt(inst, inst.answer)).toEqual({
      kind: "collect",
      xTerms: "3x + 2x = 5x",
      numbers: "4 − 1 = 3",
      result: "5x + 3",
      holds: true,
    });
    const wrong = answerReceipt(inst, { kind: "expr", x: frac(5), c: frac(5) });
    expect(wrong).toEqual({
      kind: "compare",
      x: "2",
      question: "3×2 + 4 + 2×2 − 1 = 13",
      answer: "5×2 + 5 = 15",
      questionValue: "13",
      answerValue: "15",
      holds: false,
    });
  });
});

describe("answerReceipt: over 1,000 questions per skill", () => {
  for (const { spec } of SKILLS) {
    it(`${spec.id}: the correct answer's receipt holds; every mistake's answer's receipt does not`, () => {
      for (const seed of SEEDS) {
        const inst = spec.generate(createRng(seed));
        const ok = answerReceipt(inst, inst.answer);
        expect(ok?.holds, `seed ${seed} ${inst.text}`).toBe(true);
        if (EQUATION_SKILLS.includes(spec.id)) expect(ok?.kind).toBe("substitute");
        for (const m of spec.mistakes.filter((x) => applies(x, inst))) {
          const r = answerReceipt(inst, m.apply(inst).answer);
          expect(r?.holds, `${m.id} seed ${seed} ${inst.text}`).toBe(false);
          // a wrong answer's receipt never states the correct expression
          if (r?.kind === "compare") expect(JSON.stringify(r)).not.toContain(answerText(inst.answer));
        }
      }
    });
  }
});

describe("lineReceipt: a typed Teach line", () => {
  it("equations: the same solution as the line above, checked by putting it back in", () => {
    const inst = makeBothSides({ a: 4, b: -3, c: 2, d: 7 }, 0);
    expect(lineReceipt(inst, "4x − 3 = 2x + 7", "2x − 3 = 7")).toMatchObject({
      kind: "line",
      sameSolution: true,
      solution: "x = 5",
      check: { left: "4×5 − 3 = 17", right: "2×5 + 7 = 17", holds: true },
    });
    expect(lineReceipt(inst, "4x − 3 = 2x + 7", "6x − 3 = 7")).toMatchObject({ sameSolution: false, solution: "x = 5/3", check: { holds: false } });
    expect(lineReceipt(inst, "4x − 3 = 2x + 7", "x = x")).toMatchObject({ sameSolution: false, solution: null, check: null });
    expect(lineReceipt(inst, "4x − 3 = 2x + 7", "4x ==")).toBeNull();
  });

  it("expressions and sums: the same value as the line above", () => {
    const lt = makeLikeTermsInstance({ a: 3, b: 4, c: 2, d: -1 }, 0);
    expect(lineReceipt(lt, "3x + 4 + 2x − 1", "3x + 2x + 4 − 1")).toMatchObject({ kind: "line", sameValue: true, check: { x: "2", holds: true } });
    expect(lineReceipt(lt, "3x + 4 + 2x − 1", "3x + 2x + 4 + 1")).toMatchObject({ sameValue: false, check: { holds: false } });
    const io = makeIntegersInstance({ a: -7, b: 4, op: 0 }, 0);
    expect(lineReceipt(io, "−7 + 4", "−(7 − 4)")).toEqual({ kind: "line", sameValue: true, value: "−3", check: null });
    expect(lineReceipt(io, "−7 + 4", "7 + 4")).toEqual({ kind: "line", sameValue: false, value: null, check: null });
  });

  for (const { spec } of SKILLS) {
    it(`${spec.id}: over 1,000 questions, correct lines have the same solution or value; each mistake's wrong line does not`, () => {
      for (const seed of SEEDS) {
        const inst = spec.generate(createRng(seed));
        const correct = spec.solve(inst).trace.map((l) => l.text);
        for (const m of spec.mistakes.filter((x) => applies(x, inst))) {
          const out = m.apply(inst);
          const good = teachLineReceipt(inst, m, correct[out.firstWrongLine - 1]);
          const bad = teachLineReceipt(inst, m, out.trace[out.firstWrongLine - 1].text);
          const same = (r: typeof good) => (r && ("sameSolution" in r ? r.sameSolution : r.sameValue)) ?? null;
          expect(same(good), `${m.id} seed ${seed}: "${correct[out.firstWrongLine - 1]}"`).toBe(true);
          // a line with a fraction cannot be typed (the line reader asks for whole numbers), so it gets no receipt
          const wrong = out.trace[out.firstWrongLine - 1].text;
          expect(same(bad), `${m.id} seed ${seed}: "${wrong}"`).toBe(wrong.includes("/") ? null : false);
        }
      }
    });
  }
});
