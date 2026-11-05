import { describe, expect, it } from "vitest";
import { answerText, parseAnswer, sameAnswer } from "../answer";
import { frac } from "../fraction";
import { answerReceipt, lineReceipt, teachLineReceipt } from "../receipt";
import { createRng } from "../rng";
import { getSkillEntry } from "../skills";
import { colProbTwoDice, diceCounts, makeDiceInstance } from "../skills/col-prob-two-dice";
import { describeSkillProperties } from "./skill-properties";

// F12 Part 1. col.prob.two-dice: probability with two fair dice (college pack). Question types (param t): 0 = "the
// sum is k", 1 = "the sum is at least k", 2 = "the sum is at most k". Everything is counted by code from the 36
// ordered outcomes, so the hand counts below are checked against a list of all the pairs.

const lines = (t: { text: string }[]) => t.map((l) => l.text);
const mistake = (id: string) => colProbTwoDice.mistakes.find((m) => m.id === id)!;
const SUM = 0;
const AT_LEAST = 1;
const AT_MOST = 2;
const Q7 = "Two fair dice are rolled. What is the probability that the sum is 7?";

/** Every ordered outcome, listed: the independent check of the counts. */
const OUTCOMES = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => [i + 1, j + 1] as const)).flat();
const fits = (t: number, k: number, sum: number) => (t === SUM ? sum === k : t === AT_LEAST ? sum >= k : sum <= k);

describe("col.prob.two-dice: the counts", () => {
  it("favourable ordered outcomes, unordered pairs and sums match a list of all 36 outcomes, for every question", () => {
    for (const [t, lo, hi] of [[SUM, 2, 12], [AT_LEAST, 3, 12], [AT_MOST, 2, 11]]) {
      for (let k = lo; k <= hi; k++) {
        const good = OUTCOMES.filter(([x, y]) => fits(t, k, x + y));
        const unordered = good.filter(([x, y]) => x <= y);
        const sums = new Set(good.map(([x, y]) => x + y));
        expect(diceCounts(t, k), `t ${t} k ${k}`).toEqual({ favourable: good.length, unordered: unordered.length, sums: sums.size });
      }
    }
  });

  it("the sum is 7: 6 ordered outcomes, 3 unordered pairs, 1 sum", () => {
    expect(diceCounts(SUM, 7)).toEqual({ favourable: 6, unordered: 3, sums: 1 });
  });
});

describe("col.prob.two-dice: worked examples", () => {
  const inst = makeDiceInstance({ t: SUM, k: 7 }, 0);

  it("the sum is 7: L1 the question · L2 6 × 6 · L3 6 · L4 6/36 · L5 1/6", () => {
    expect(inst.text).toBe(Q7);
    expect(lines(colProbTwoDice.solve(inst).trace)).toEqual([Q7, "6 × 6", "6", "6/36", "1/6"]);
    expect(answerText(inst.answer)).toBe("1/6");
  });

  it("at least and at most read as the words say", () => {
    expect(makeDiceInstance({ t: AT_LEAST, k: 10 }, 0).text).toBe("Two fair dice are rolled. What is the probability that the sum is at least 10?");
    expect(answerText(makeDiceInstance({ t: AT_LEAST, k: 10 }, 0).answer)).toBe("1/6");
    expect(makeDiceInstance({ t: AT_MOST, k: 4 }, 0).text).toBe("Two fair dice are rolled. What is the probability that the sum is at most 4?");
    expect(answerText(makeDiceInstance({ t: AT_MOST, k: 4 }, 0).answer)).toBe("1/6");
  });

  it("a fraction already in its simplest form stops at L4", () => {
    const five = makeDiceInstance({ t: SUM, k: 6 }, 0);
    expect(lines(colProbTwoDice.solve(five).trace).slice(1)).toEqual(["6 × 6", "5", "5/36"]);
  });

  it("sums-equally-likely: favourable sums out of 11, first wrong at L2", () => {
    const out = mistake("sums-equally-likely").apply(inst);
    expect([lines(out.trace), answerText(out.answer), out.firstWrongLine]).toEqual([[Q7, "11", "1", "1/11"], "1/11", 2]);
  });

  it("unordered-pairs: unordered pairs out of 21, first wrong at L2", () => {
    const out = mistake("unordered-pairs").apply(inst);
    expect([lines(out.trace), answerText(out.answer), out.firstWrongLine]).toEqual([[Q7, "21", "3", "3/21", "1/7"], "1/7", 2]);
  });

  it("one-order-only: unordered pairs out of 36, first wrong at L3", () => {
    const out = mistake("one-order-only").apply(inst);
    expect([lines(out.trace), answerText(out.answer), out.firstWrongLine]).toEqual([[Q7, "6 × 6", "3", "3/36", "1/12"], "1/12", 3]);
  });

  it("an answer in any form counts (6/36 = 1/6), as for every other skill", () => {
    for (const typed of ["1/6", "6/36", "3/18"]) {
      const parsed = parseAnswer(typed);
      expect(parsed.ok && sameAnswer(parsed.value, inst.answer), typed).toBe(true);
    }
  });
});

describe("col.prob.two-dice: the rules", () => {
  it("number answers, no prerequisites, the shared teach and proof rules, 4 hints", () => {
    expect(colProbTwoDice.answerKind).toBe("number");
    expect(colProbTwoDice.prerequisites).toEqual([]);
    expect(colProbTwoDice.teachRule).toEqual({ traces: 3, distinctMistakesMin: 2, triesMax: 2 });
    expect(colProbTwoDice.proofRule).toEqual({ solve: 3, apply: 1, allCorrect: true });
    expect(colProbTwoDice.hintLadder).toHaveLength(4);
  });

  it("keeps all 3 mistakes (at least 2 must remain), and rejects the draws where a mistake would give the right answer", () => {
    expect(colProbTwoDice.mistakes.map((m) => m.id)).toEqual(["sums-equally-likely", "unordered-pairs", "one-order-only"]);
    const kept = new Set<string>();
    for (let seed = 1; seed <= 1000; seed++) {
      const inst = colProbTwoDice.generate(createRng(seed));
      const { t, k } = inst.params;
      kept.add(`${t}|${k}`);
      expect([SUM, AT_LEAST, AT_MOST]).toContain(t);
      expect(k).toBeGreaterThanOrEqual(t === AT_LEAST ? 3 : 2);
      expect(k).toBeLessThanOrEqual(t === AT_MOST ? 11 : 12);
      const answers = [inst.answer, ...colProbTwoDice.mistakes.map((m) => m.apply(inst).answer)].map(answerText);
      expect(new Set(answers).size, `seed ${seed}: ${answers.join(", ")}`).toBe(4);
    }
    // the sum is 2 or 12, at least 12, at most 2: one outcome, the same counted either way, so never asked
    for (const never of [`${SUM}|2`, `${SUM}|12`, `${AT_LEAST}|12`, `${AT_MOST}|2`]) expect(kept).not.toContain(never);
    expect(kept.size).toBe(27);
  });

  it("over 1,000 seeds the answer is the listed count over 36, and never 0 or 1", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const inst = colProbTwoDice.generate(createRng(seed));
      const { t, k } = inst.params;
      const good = OUTCOMES.filter(([x, y]) => fits(t, k, x + y)).length;
      expect(sameAnswer(inst.answer, frac(good, 36)), inst.text).toBe(true);
      expect(good).toBeGreaterThan(0);
      expect(good).toBeLessThan(36);
    }
  });

  it("a word problem is the same question, in English and Hindi", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const item = getSkillEntry("col.prob.two-dice")!.generateApply(createRng(seed));
      expect(item.text).toMatch(/two fair dice/i);
      expect(item.textHi).toMatch(/पास/);
      expect(item.text).toContain(`${item.instance.params.k}`);
      expect(item.textHi).toContain(`${item.instance.params.k}`);
    }
  });
});

describe("col.prob.two-dice: a typed line in Teach the Shishya", () => {
  const inst = makeDiceInstance({ t: SUM, k: 7 }, 0);

  it("line 2 counts all the outcomes; line 3 counts the outcomes that fit; each says so when it is wrong", () => {
    for (const typed of ["6 × 6", "6*6", "6 x 6", "36"]) expect(colProbTwoDice.checkLine(inst, 2, typed).ok, typed).toBe(true);
    expect(colProbTwoDice.checkLine(inst, 2, "21")).toMatchObject({ ok: false, feedbackKey: "teach.fix.allOutcomes" });
    expect(colProbTwoDice.checkLine(inst, 3, "6").ok).toBe(true);
    expect(colProbTwoDice.checkLine(inst, 3, "3")).toMatchObject({ ok: false, feedbackKey: "teach.fix.favourable" });
  });

  it("line 4 is the fraction; the last line is its simplest form", () => {
    expect(colProbTwoDice.checkLine(inst, 4, "6/36").ok).toBe(true);
    expect(colProbTwoDice.checkLine(inst, 4, "6/21")).toMatchObject({ ok: false, feedbackKey: "teach.fix.sameFraction" });
    expect(colProbTwoDice.checkLine(inst, 5, "1/6").ok).toBe(true);
    expect(colProbTwoDice.checkLine(inst, 5, "2/12")).toMatchObject({ ok: false, feedbackKey: "teach.fix.simplestFraction" });
    expect(colProbTwoDice.checkLine(inst, 5, "1/7")).toMatchObject({ ok: false, feedbackKey: "teach.fix.sameFraction" });
  });

  it("a line it cannot read says what can be typed", () => {
    expect(colProbTwoDice.checkLine(inst, 2, "all of them")).toMatchObject({ ok: false, feedbackKey: "teach.fix.collegeArith" });
  });

  it("its receipt talks about counting: it never calls a right line wrong, and never gives the count that fits", () => {
    expect(lineReceipt(inst, Q7, "6 × 6")).toEqual({ kind: "line", sameValue: true, value: "36", check: null, count: "all" });
    expect(lineReceipt(inst, Q7, "21")).toEqual({ kind: "line", sameValue: false, value: "21", check: null, count: "all" });
    expect(lineReceipt(inst, "6 × 6", "6")).toEqual({ kind: "line", sameValue: true, value: "6", check: null, count: "favourable" });
    expect(lineReceipt(inst, "6 × 6", "3")).toEqual({ kind: "line", sameValue: false, value: "3", check: null, count: "favourable" });
    expect(lineReceipt(inst, Q7, "no idea")).toBeNull();
  });
});

describe("col.prob.two-dice: How we checked", () => {
  const inst = makeDiceInstance({ t: SUM, k: 7 }, 0);

  it("a right answer: answer × 36 is the number of outcomes that fit", () => {
    expect(answerReceipt(inst, frac(6, 36))).toEqual({ kind: "dice", value: "1/6", check: "1/6 × 36 = 6", outcomes: "6", total: "36", holds: true });
  });

  it("a wrong answer: the check does not hold, and the correct answer is not written", () => {
    const r = answerReceipt(inst, frac(1, 7));
    expect(r).toEqual({ kind: "dice", value: "1/7", check: "1/7 × 36 = 36/7", outcomes: "36/7", total: "36", holds: false });
    expect(JSON.stringify(r)).not.toContain("1/6");
  });

  it("over 1,000 questions: the correct answer's receipt holds; every mistake's does not; right lines count as right", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const q = colProbTwoDice.generate(createRng(seed));
      expect(answerReceipt(q, q.answer)?.holds, `seed ${seed}`).toBe(true);
      const correct = lines(colProbTwoDice.solve(q).trace);
      for (const m of colProbTwoDice.mistakes) {
        const out = m.apply(q);
        expect(answerReceipt(q, out.answer)?.holds, `${m.id} seed ${seed}`).toBe(false);
        expect(teachLineReceipt(q, m, correct[out.firstWrongLine - 1]), `${m.id} seed ${seed}`).toMatchObject({ sameValue: true });
        expect(teachLineReceipt(q, m, out.trace[out.firstWrongLine - 1].text), `${m.id} seed ${seed}`).toMatchObject({ sameValue: false });
      }
    }
  });
});

describeSkillProperties(getSkillEntry("col.prob.two-dice")!, {
  leak: (ans) => new RegExp(`= ${answerText(ans)}(?!\\d)`),
});
