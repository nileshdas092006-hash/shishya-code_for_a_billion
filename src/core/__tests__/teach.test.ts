import { describe, expect, it } from "vitest";
import { createRng } from "../rng";
import { linearBothSides, makeInstance } from "../skills/linear-both-sides";
import { checkTeachStep } from "../teach";

const SEEDS = Array.from({ length: 1000 }, (_, i) => i + 1);

describe("checkTeachStep: 4x − 3 = 2x + 7 with kept-x-sign", () => {
  const inst = makeInstance({ a: 4, b: -3, c: 2, d: 7 }, 0);
  const check = (tapped: number, typed: string) => checkTeachStep(inst, "kept-x-sign", tapped, typed);

  it("accepts the textbook fix on line 2", () => {
    expect(check(2, "4x − 2x − 3 = 7")).toMatchObject({ lineCorrect: true, fixAccepted: true });
  });

  it("accepts a combined step on line 2", () => {
    expect(check(2, "2x − 3 = 7")).toMatchObject({ lineCorrect: true, fixAccepted: true });
  });

  it("rejects the Shishya's own wrong line", () => {
    expect(check(2, "4x + 2x − 3 = 7")).toMatchObject({ lineCorrect: true, fixAccepted: false });
  });

  it("rejects a line that still has x on the right", () => {
    const r = check(2, "4x − 3 − 7 = 2x");
    expect(r).toMatchObject({ lineCorrect: true, fixAccepted: false });
    expect(r.feedback.toLowerCase()).toContain("right side");
  });

  it("tapping line 3 is the wrong line", () => {
    const r = check(3, "4x − 2x − 3 = 7");
    expect(r.lineCorrect).toBe(false);
    expect(r.feedback.length).toBeGreaterThan(0);
  });

  it("explains a line it cannot read", () => {
    const r = check(2, "4x ==");
    expect(r).toMatchObject({ lineCorrect: true, fixAccepted: false });
    expect(r.feedback.length).toBeGreaterThan(0);
  });

  it("throws for an unknown mistake id (a programming error, not a child error)", () => {
    expect(() => checkTeachStep(inst, "no-such-mistake", 2, "x = 1")).toThrow();
  });
});

describe("checkTeachStep: property over 1,000 seeds and every mistake", () => {
  it("accepts the correct line, rejects the wrong line, and never states the answer", () => {
    for (const seed of SEEDS) {
      const inst = linearBothSides.generate(createRng(seed));
      const correct = linearBothSides.solve(inst).trace;
      const answer = Math.abs(inst.answer.num);
      const leak = new RegExp(`x = [−-]?${answer}(?!\\d)`);
      for (const m of linearBothSides.mistakes) {
        const out = m.apply(inst);
        const line = out.firstWrongLine;
        const good = checkTeachStep(inst, m.id, line, correct[line - 1].text);
        const bad = checkTeachStep(inst, m.id, line, out.trace[line - 1].text);
        const missed = checkTeachStep(inst, m.id, line === 2 ? 3 : 2, correct[line - 1].text);
        expect(good, `seed ${seed} ${m.id}`).toMatchObject({ lineCorrect: true, fixAccepted: true });
        expect(bad.fixAccepted, `seed ${seed} ${m.id}`).toBe(false);
        expect(missed.lineCorrect).toBe(false);
        for (const r of [good, bad, missed]) {
          expect(r.feedback).not.toMatch(leak);
          expect(r.feedback.toLowerCase()).not.toMatch(/\bmov(e|es|ed|ing)\b|change (the|its) sign/);
        }
      }
    }
  });
});

describe("teach feedback carries a message key", () => {
  const inst = makeInstance({ a: 4, b: -3, c: 2, d: 7 }, 0);
  const check = (tapped: number, typed: string) => checkTeachStep(inst, "kept-x-sign", tapped, typed);

  it.each([
    [2, "4x − 2x − 3 = 7", "teach.fix.ok", undefined],
    [2, "4x + 2x − 3 = 7", "teach.fix.notEqual", undefined],
    [2, "4x − 3 − 7 = 2x", "teach.fix.shape.2", undefined],
    [2, "4x ==", "parse.manyEquals", undefined],
    [1, "4x − 2x − 3 = 7", "teach.tap.tooEarly", { line: 1 }],
    [3, "4x − 2x − 3 = 7", "teach.tap.tooLate", { line: 3 }],
  ] as const)("tap %i, %j → %s", (tapped, typed, key, params) => {
    const r = check(tapped, typed);
    expect(r.feedbackKey).toBe(key);
    expect(r.feedbackParams).toEqual(params);
  });
});

describe("checkTeachStep with a mined mistake", () => {
  it("uses the mistake list it is given", async () => {
    const { toMinedMistakeForTest } = await import("./teach-mined-fixture");
    const mined = toMinedMistakeForTest();
    const inst = makeInstance({ a: 4, b: -3, c: 2, d: 7 }, 0);
    const mistakes = [...linearBothSides.mistakes, mined];
    expect(() => checkTeachStep(inst, mined.id, 5, "x = 5")).toThrow(); // not in the default (authored) list
    expect(checkTeachStep(inst, mined.id, 5, "x = 5", mistakes)).toMatchObject({ lineCorrect: true, fixAccepted: true });
    expect(checkTeachStep(inst, mined.id, 5, "x = 5/2", mistakes).fixAccepted).toBe(false);
  });
});
