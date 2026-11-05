import { describe, expect, it } from "vitest";
import { answerText, sameAnswer } from "../answer";
import { frac } from "../fraction";
import { createRng } from "../rng";
import { answerReceipt, lineReceipt, teachLineReceipt } from "../receipt";
import { getSkillEntry } from "../skills";
import { colMatrixDet2, makeDetInstance } from "../skills/col-matrix-det2";
import { describeSkillProperties } from "./skill-properties";

// F12 Part 1. col.matrix.det2: the determinant of a 2×2 matrix (college pack), checked by code with exact fractions.

const lines = (t: { text: string }[]) => t.map((l) => l.text);
const mistake = (id: string) => colMatrixDet2.mistakes.find((m) => m.id === id)!;
const EXAMPLE = { a: 3, b: -2, c: 4, d: 5 };
const QUESTION = "[[3, −2], [4, 5]]";

describe("col.matrix.det2: the worked example", () => {
  const inst = makeDetInstance(EXAMPLE, 0);

  it("[[3, −2], [4, 5]]: L1 the question · L2 3 × 5 − (−2) × 4 · L3 15 − (−8) · L4 23", () => {
    expect(inst.text).toBe(QUESTION);
    expect(lines(colMatrixDet2.solve(inst).trace)).toEqual([QUESTION, "3 × 5 − (−2) × 4", "15 − (−8)", "23"]);
    expect(answerText(inst.answer)).toBe("23");
  });

  it("added-the-products: ad + bc, first wrong at L2", () => {
    const out = mistake("added-the-products").apply(inst);
    expect([lines(out.trace), answerText(out.answer), out.firstWrongLine]).toEqual([[QUESTION, "3 × 5 + (−2) × 4", "15 + (−8)", "7"], "7", 2]);
    expect(mistake("added-the-products").childLabel).toBe("The determinant subtracts the second diagonal's product.");
  });

  it("reversed-order: bc − ad, first wrong at L2", () => {
    const out = mistake("reversed-order").apply(inst);
    expect([lines(out.trace), answerText(out.answer), out.firstWrongLine]).toEqual([[QUESTION, "(−2) × 4 − 3 × 5", "−8 − 15", "−23"], "-23", 2]);
    expect(mistake("reversed-order").childLabel).toBe("Start with the main diagonal (top-left × bottom-right).");
  });

  it("rows-not-diagonals: ab − cd, first wrong at L2", () => {
    const out = mistake("rows-not-diagonals").apply(inst);
    expect([lines(out.trace), answerText(out.answer), out.firstWrongLine]).toEqual([[QUESTION, "3 × (−2) − 4 × 5", "−6 − 20", "−26"], "-26", 2]);
    expect(mistake("rows-not-diagonals").childLabel).toBe("Multiply along the diagonals, not along the rows.");
  });

  it("has exactly these three mistakes, each with a step type", () => {
    expect(colMatrixDet2.mistakes.map((m) => m.id)).toEqual(["added-the-products", "reversed-order", "rows-not-diagonals"]);
    for (const m of colMatrixDet2.mistakes) {
      expect(m.origin).toBe("authored");
      expect(m.stepType).toBeTruthy();
    }
  });

  it("negative numbers in brackets in every product, whichever place they are in", () => {
    const n = makeDetInstance({ a: -3, b: 2, c: -4, d: -5 }, 0);
    expect(lines(colMatrixDet2.solve(n).trace)).toEqual(["[[−3, 2], [−4, −5]]", "(−3) × (−5) − 2 × (−4)", "15 − (−8)", "23"]);
  });
});

describe("col.matrix.det2: the rules", () => {
  it("number answers, no prerequisites, the shared teach and proof rules, 4 hints", () => {
    expect(colMatrixDet2.answerKind).toBe("number");
    expect(colMatrixDet2.prerequisites).toEqual([]);
    expect(colMatrixDet2.teachRule).toEqual({ traces: 3, distinctMistakesMin: 2, triesMax: 2 });
    expect(colMatrixDet2.proofRule).toEqual({ solve: 3, apply: 1, allCorrect: true });
    expect(colMatrixDet2.hintLadder).toHaveLength(4);
  });

  it("generator, 1,000 seeds: whole numbers −9…9, none 0, at least one negative, ad − bc ≠ 0, all answers different", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const inst = colMatrixDet2.generate(createRng(seed));
      const { a, b, c, d } = inst.params;
      for (const v of [a, b, c, d]) expect(Number.isInteger(v) && v !== 0 && Math.abs(v) <= 9, `seed ${seed}`).toBe(true);
      expect(a < 0 || b < 0 || c < 0 || d < 0, `seed ${seed}`).toBe(true);
      expect(a * d - b * c, `seed ${seed}`).not.toBe(0);
      expect(sameAnswer(inst.answer, frac(a * d - b * c))).toBe(true);
      const answers = [inst.answer, ...colMatrixDet2.mistakes.map((m) => m.apply(inst).answer)].map(answerText);
      expect(new Set(answers).size, `seed ${seed}: ${answers.join(", ")}`).toBe(4);
    }
  });

  it("a word problem is the same determinant, in English and Hindi", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const item = getSkillEntry("col.matrix.det2")!.generateApply(createRng(seed));
      const { a, b, c, d } = item.instance.params;
      expect(sameAnswer(item.instance.answer, frac(a * d - b * c))).toBe(true);
      expect(item.text).toMatch(/determinant/);
      expect(item.textHi).toMatch(/सारणिक/);
    }
  });
});

describe("col.matrix.det2: a typed line in Teach the Shishya", () => {
  const inst = makeDetInstance(EXAMPLE, 0);

  it("accepts any way of writing the right value, with ×, * or x for times", () => {
    for (const typed of ["3 × 5 − (−2) × 4", "3*5-(-2)*4", "3 x 5 - (-2) x 4", "15 + 8", "23"]) {
      expect(colMatrixDet2.checkLine(inst, 2, typed).ok, typed).toBe(true);
    }
    expect(colMatrixDet2.checkLine(inst, 2, "23").feedbackKey).toBe("teach.fix.okValue");
  });

  it("refuses a wrong value, and says what can be typed when it cannot read a line", () => {
    expect(colMatrixDet2.checkLine(inst, 2, "3 × 5 + (−2) × 4")).toMatchObject({ ok: false, feedbackKey: "teach.fix.sameValue" });
    expect(colMatrixDet2.checkLine(inst, 2, "[[3, 2]]")).toMatchObject({ ok: false, feedbackKey: "teach.fix.collegeArith" });
    expect(colMatrixDet2.checkLine(inst, 2, QUESTION)).toMatchObject({ ok: false });
  });

  it("the last line is one number", () => {
    expect(colMatrixDet2.checkLine(inst, 4, "23").ok).toBe(true);
    expect(colMatrixDet2.checkLine(inst, 4, "15 + 8")).toMatchObject({ ok: false, feedbackKey: "teach.fix.oneNumber" });
  });

  it("its receipt says the typed line has the question's value, and never states it when it does not", () => {
    expect(lineReceipt(inst, QUESTION, "15 + 8")).toEqual({ kind: "line", sameValue: true, value: "23", check: null });
    expect(lineReceipt(inst, QUESTION, "3 x 5 + 2 x 4")).toEqual({ kind: "line", sameValue: true, value: "23", check: null });
    expect(lineReceipt(inst, QUESTION, "15 − 8")).toEqual({ kind: "line", sameValue: false, value: null, check: null });
    expect(lineReceipt(inst, QUESTION, "no idea")).toBeNull();
  });
});

describe("col.matrix.det2: How we checked", () => {
  const inst = makeDetInstance(EXAMPLE, 0);

  it("a right answer: the two diagonals, and answer + second product gives the main product", () => {
    expect(answerReceipt(inst, frac(23))).toEqual({
      kind: "determinant",
      value: "23",
      main: "3 × 5 = 15",
      second: "(−2) × 4 = −8",
      check: "23 + (−8) = 15",
      back: "15",
      start: "15",
      holds: true,
    });
  });

  it("a wrong answer: the check does not hold, and the correct answer is not written", () => {
    const r = answerReceipt(inst, frac(7));
    expect(r).toMatchObject({ kind: "determinant", value: "7", check: "7 + (−8) = −1", back: "−1", start: "15", holds: false });
    expect(JSON.stringify(r)).not.toContain("23");
  });

  it("over 1,000 questions: the correct answer's receipt holds; every mistake's does not; right lines get a same-value receipt", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const q = colMatrixDet2.generate(createRng(seed));
      expect(answerReceipt(q, q.answer)?.holds, `seed ${seed}`).toBe(true);
      const correct = lines(colMatrixDet2.solve(q).trace);
      for (const m of colMatrixDet2.mistakes) {
        const out = m.apply(q);
        expect(answerReceipt(q, out.answer)?.holds, `${m.id} seed ${seed}`).toBe(false);
        expect(teachLineReceipt(q, m, correct[out.firstWrongLine - 1]), `${m.id} seed ${seed}`).toMatchObject({ sameValue: true });
        expect(teachLineReceipt(q, m, out.trace[out.firstWrongLine - 1].text), `${m.id} seed ${seed}`).toMatchObject({ sameValue: false });
      }
    }
  });
});

describeSkillProperties(getSkillEntry("col.matrix.det2")!, {
  leak: (ans) => new RegExp(`= [−-]?${answerText(ans).replace("-", "")}(?!\\d)`),
});
