import { describe, expect, it } from "vitest";
import { en } from "../../i18n/en";
import { computeImpact, HONESTY_NOTE, METHOD_NOTE, SCOPE_NOTE, type ImpactRows } from "../impact";
import { paired, tQuantile, welch } from "../stats";

// F11 Part 3. /impact and /api/impact: the Shishya Challenge's numbers, worked out by a PURE function from real
// challenge classes only (never test or tour classes). Any average over fewer than 5 students is not shown.
// Hand calculations are written out next to each expected number.

describe("the t distribution", () => {
  it("97.5% points match the printed tables", () => {
    const table: [number, number][] = [
      [1, 12.706],
      [2, 4.303],
      [4, 2.776],
      [8, 2.306],
      [9, 2.262],
      [29, 2.045],
      [100, 1.984],
      [1e6, 1.96],
    ];
    for (const [df, t] of table) expect(tQuantile(0.975, df), `df ${df}`).toBeCloseTo(t, 3);
  });
});

describe("paired and two-group intervals", () => {
  it("a paired mean difference and its 95% t-interval, by hand", () => {
    // before 2 3 1 4 3, after 4 5 2 5 3 → differences 2 2 1 1 0: mean 1.2
    // deviations .8 .8 −.2 −.2 −1.2 → squares .64 .64 .04 .04 1.44 = 2.8; variance 2.8/4 = .7; sd .83666
    // se = .83666/√5 = .37417; t(.975, 4) = 2.7764; half width 1.0389 → [0.1611, 2.2389]
    const r = paired([2, 3, 1, 4, 3], [4, 5, 2, 5, 3]);
    expect(r.n).toBe(5);
    expect(r.before).toBeCloseTo(2.6, 10);
    expect(r.after).toBeCloseTo(3.8, 10);
    expect(r.difference).toBeCloseTo(1.2, 10);
    expect(r.ci95[0]).toBeCloseTo(0.1611, 3);
    expect(r.ci95[1]).toBeCloseTo(2.2389, 3);
  });

  it("the difference between two groups' mean gains, with Welch's 95% interval, by hand", () => {
    // gains A 1 1 2 0 1 (mean 1, variance 2/4 = .5); B 2 3 2 1 2 (mean 2, variance .5)
    // difference B − A = 1; se = √(.5/5 + .5/5) = .44721; Welch df = (.1 + .1)² / (.1²/4 + .1²/4) = 8
    // t(.975, 8) = 2.3060; half width 1.0313 → [−0.0313, 2.0313]
    const r = welch([1, 1, 2, 0, 1], [2, 3, 2, 1, 2]);
    expect(r.difference).toBeCloseTo(1, 10);
    expect(r.df).toBeCloseTo(8, 10);
    expect(r.ci95[0]).toBeCloseTo(-0.0313, 3);
    expect(r.ci95[1]).toBeCloseTo(2.0313, 3);
  });

  it("all the same gain: an interval of width 0, not a division by zero", () => {
    expect(paired([1, 1, 1, 1, 1], [3, 3, 3, 3, 3]).ci95).toEqual([2, 2]);
    expect(welch([1, 1, 1, 1, 1], [2, 2, 2, 2, 2]).ci95).toEqual([1, 1]);
  });
});

// ---------- fixtures: one real challenge class, plus classes that must never count ----------

type Student = ImpactRows["students"][number];
let n = 0;
function rowsWith(spec: { grade: number; group: "A" | "B"; pre?: number; post?: number; delayed?: number; classId?: string }[]): ImpactRows {
  const rows: ImpactRows = {
    classes: [
      { id: "real", kind: "real", mode: "challenge" },
      { id: "trial", kind: "test", mode: "challenge" },
      { id: "tour", kind: "sandbox", mode: "classroom" },
      { id: "school", kind: "real", mode: "classroom" },
    ],
    students: [],
    checks: [],
    feedback: [],
    wrongAnswers: [],
    mistakeLabels: {},
    mined: [],
  };
  for (const s of spec) {
    const id = `student-${++n}`;
    const student: Student = { id, classId: s.classId ?? "real", code: `${s.grade}C-Q${String(n).padStart(3, "X")}`, selfGrade: s.grade, studyArm: s.group };
    rows.students.push(student);
    if (s.pre !== undefined) rows.checks.push({ studentId: id, phase: "pre", score: s.pre });
    if (s.post !== undefined) rows.checks.push({ studentId: id, phase: "post", score: s.post });
    if (s.delayed !== undefined) rows.checks.push({ studentId: id, phase: "delayed", score: s.delayed });
  }
  return rows;
}
const NOW = new Date("2026-11-08T10:30:00.000Z");

describe("computeImpact", () => {
  it("states its date and time, real challenge classes only, and the fixed honesty note", () => {
    const out = computeImpact(rowsWith([]), NOW);
    expect(out.generatedAt).toBe("2026-11-08T10:30:00.000Z");
    expect(out.honesty).toBe(
      "An online trial: students chose to join, did one session on their own phones, and there was no classroom teacher. Small numbers. Not a classroom study.",
    );
    expect(HONESTY_NOTE).toBe(out.honesty);
    // the page says exactly what the JSON says
    expect(en["impact.honesty"]).toBe(HONESTY_NOTE);
    expect(en["impact.scope"]).toBe(SCOPE_NOTE);
    expect(en["impact.method"]).toBe(METHOD_NOTE);
    expect(out.reached).toMatchObject({ joined: 0, finishedBefore: 0, finishedBoth: 0 });
    expect(out.scores.all).toEqual({ shown: false, n: 0 });
  });

  it("students reached, finished the before check, finished both; by class level", () => {
    const out = computeImpact(rowsWith([{ grade: 7, group: "A", pre: 2, post: 4 }, { grade: 7, group: "B", pre: 1 }, { grade: 9, group: "A" }]), NOW);
    expect(out.reached).toEqual({
      joined: 3,
      finishedBefore: 2,
      finishedBoth: 1,
      byClassLevel: [
        { level: 7, joined: 2, finishedBefore: 2, finishedBoth: 1 },
        { level: 8, joined: 0, finishedBefore: 0, finishedBoth: 0 },
        { level: 9, joined: 1, finishedBefore: 0, finishedBoth: 0 },
        { level: 10, joined: 0, finishedBefore: 0, finishedBoth: 0 },
      ],
    });
  });

  it("the average before → after with the paired difference and its interval matches the hand calculation", () => {
    const pre = [2, 3, 1, 4, 3];
    const post = [4, 5, 2, 5, 3];
    const out = computeImpact(rowsWith(pre.map((p, i) => ({ grade: 8, group: i % 2 ? "B" : "A", pre: p, post: post[i] }))), NOW);
    expect(out.scores.outOf).toBe(6);
    expect(out.scores.all).toEqual({ shown: true, n: 5, before: 2.6, after: 3.8, difference: 1.2, ci95: [0.16, 2.24] });
  });

  it("a group with fewer than 5 students is not shown (by class level and by group), nor the difference between groups", () => {
    const five = [0, 1, 2, 3, 4].map((i) => ({ grade: 9, group: "A" as const, pre: i, post: i + 1 }));
    const four = [0, 1, 2, 3].map((i) => ({ grade: 7, group: "B" as const, pre: i, post: i + 2 }));
    const out = computeImpact(rowsWith([...five, ...four]), NOW);
    expect(out.scores.all).toMatchObject({ shown: true, n: 9 });
    expect(out.scores.byGroup.A).toMatchObject({ shown: true, n: 5, difference: 1 });
    expect(out.scores.byGroup.B).toEqual({ shown: false, n: 4 });
    expect(out.scores.byGroup.difference).toEqual({ shown: false });
    expect(out.scores.byClassLevel.find((l) => l.level === 9)!.result).toMatchObject({ shown: true, n: 5 });
    expect(out.scores.byClassLevel.find((l) => l.level === 7)!.result).toEqual({ shown: false, n: 4 });
    expect(out.scores.byClassLevel.find((l) => l.level === 8)!.result).toEqual({ shown: false, n: 0 });
    // and with fewer than 5 in all, nothing is averaged at all
    expect(computeImpact(rowsWith(four), NOW).scores.all).toEqual({ shown: false, n: 4 });
  });

  it("the difference between groups (B practise + teach minus A practise only) with Welch's interval, by hand", () => {
    const a = [1, 1, 2, 0, 1].map((g, i) => ({ grade: 8, group: "A" as const, pre: 2, post: 2 + g + 0 * i }));
    const b = [2, 3, 2, 1, 2].map((g) => ({ grade: 10, group: "B" as const, pre: 1, post: 1 + g }));
    const out = computeImpact(rowsWith([...a, ...b]), NOW);
    expect(out.scores.byGroup.difference).toEqual({ shown: true, nA: 5, nB: 5, difference: 1, ci95: [-0.03, 2.03] });
  });

  it("test, tour and classroom classes are never counted", () => {
    const real = [0, 1, 2, 3, 4].map((i) => ({ grade: 8, group: "A" as const, pre: 1, post: 2 + (i % 2) }));
    const others = ["trial", "tour", "school"].flatMap((classId) => [0, 1, 2, 3, 4, 5].map(() => ({ grade: 8, group: "B" as const, pre: 0, post: 6, delayed: 4, classId })));
    const rows = rowsWith([...real, ...others]);
    for (const s of rows.students.filter((x) => x.classId !== "real")) {
      rows.feedback.push({ studentId: s.id, useful: 1, teachHelped: 1, comment: "NOT-REAL-QUOTE", quoteOk: true, approved: true });
      rows.wrongAnswers.push({ studentId: s.id, skillId: "alg.linear.both-sides", mistakeId: "kept-x-sign", count: 9 });
    }
    const out = computeImpact(rows, NOW);
    expect(out.reached.joined).toBe(5);
    expect(out.scores.all).toMatchObject({ n: 5, before: 1 });
    expect(out.scores.byGroup.B).toEqual({ shown: false, n: 0 });
    expect(out.delayed).toEqual({ outOf: 4, n: 0, shown: false });
    expect(out.ratings.useful).toEqual({ n: 0, shown: false });
    expect(out.mistakes.wrongAnswers).toBe(0);
    expect(JSON.stringify(out)).not.toContain("NOT-REAL-QUOTE");
  });

  it("only comments the student allowed to quote AND the organiser approved are ever in it", () => {
    const rows = rowsWith([7, 7, 7, 7, 7, 9].map((grade) => ({ grade, group: "A" as const, pre: 1, post: 2 })));
    const [s1, s2, s3, s4, s5, s6] = rows.students.map((s) => s.id);
    rows.feedback.push(
      { studentId: s1, useful: 5, teachHelped: null, comment: "APPROVED-QUOTE", quoteOk: true, approved: true },
      { studentId: s2, useful: 4, teachHelped: null, comment: "NOT-DECIDED", quoteOk: true, approved: null },
      { studentId: s3, useful: 4, teachHelped: null, comment: "HIDDEN", quoteOk: true, approved: false },
      { studentId: s4, useful: 4, teachHelped: null, comment: "NO-PERMISSION", quoteOk: false, approved: true },
      { studentId: s5, useful: 4, teachHelped: null, comment: null, quoteOk: false, approved: null },
      { studentId: s6, useful: 3, teachHelped: null, comment: "CLASS-9-QUOTE", quoteOk: true, approved: true },
    );
    const out = computeImpact(rows, NOW);
    // a class level is given with a quote only when at least 5 students of that level joined (Class 7: 5, Class 9: 1)
    expect(out.quotes).toEqual([
      { text: "APPROVED-QUOTE", classLevel: 7 },
      { text: "CLASS-9-QUOTE", classLevel: null },
    ]);
    const json = JSON.stringify(out);
    for (const hidden of ["NOT-DECIDED", "HIDDEN", "NO-PERMISSION"]) expect(json).not.toContain(hidden);
  });

  it("an approved quote that has a student's code in it is left out (a code logs in as that student)", () => {
    const rows = rowsWith([{ grade: 8, group: "A", pre: 1, post: 2 }, { grade: 8, group: "B", pre: 1, post: 2 }]);
    const [a, b] = rows.students;
    rows.feedback.push(
      { studentId: a.id, useful: 5, teachHelped: null, comment: `my code is ${b.code.toLowerCase()}`, quoteOk: true, approved: true },
      { studentId: b.id, useful: 5, teachHelped: 5, comment: "Loved it", quoteOk: true, approved: true },
    );
    expect(computeImpact(rows, NOW).quotes.map((q) => q.text)).toEqual(["Loved it"]);
  });

  it("no student code, id or class id anywhere in the output", () => {
    const rows = rowsWith([0, 1, 2, 3, 4, 5, 6].map((i) => ({ grade: 7 + (i % 4), group: i % 2 ? "B" : "A", pre: i % 6, post: (i + 2) % 7, delayed: i % 5 })));
    for (const s of rows.students) rows.feedback.push({ studentId: s.id, useful: 4, teachHelped: s.studyArm === "B" ? 5 : null, comment: `fine ${s.code}`, quoteOk: true, approved: false });
    const json = JSON.stringify(computeImpact(rows, NOW));
    for (const s of rows.students) {
      expect(json).not.toContain(s.code);
      expect(json).not.toContain(s.id);
    }
    for (const c of rows.classes) expect(json).not.toContain(`"${c.id}"`);
  });

  it("the later check: n and its average (out of 4), shown from 5 students", () => {
    const four = [4, 3, 2, 4].map((d) => ({ grade: 8, group: "A" as const, pre: 1, post: 2, delayed: d }));
    expect(computeImpact(rowsWith(four), NOW).delayed).toEqual({ outOf: 4, n: 4, shown: false });
    const five = [4, 3, 2, 4, 2].map((d) => ({ grade: 8, group: "A" as const, pre: 1, post: 2, delayed: d }));
    expect(computeImpact(rowsWith(five), NOW).delayed).toEqual({ outOf: 4, n: 5, shown: true, average: 3 }); // 15 / 5
  });

  it("ratings: average 'useful' and 'teaching helped' with n, shown from 5 answers", () => {
    const rows = rowsWith([0, 1, 2, 3, 4, 5].map((i) => ({ grade: 8, group: i < 4 ? "B" : "A", pre: 1, post: 2 })));
    const useful = [5, 4, 4, 3, 5, 3];
    rows.students.forEach((s, i) => rows.feedback.push({ studentId: s.id, useful: useful[i], teachHelped: s.studyArm === "B" ? 4 : null, comment: null, quoteOk: false, approved: null }));
    const out = computeImpact(rows, NOW);
    expect(out.ratings.useful).toEqual({ n: 6, shown: true, average: 4 }); // 24 / 6
    expect(out.ratings.teachHelped).toEqual({ n: 4, shown: false });
  });

  it("wrong answers explained by known mistakes, and the 3 most common (labels only)", () => {
    const rows = rowsWith([{ grade: 8, group: "A" }, { grade: 9, group: "B" }]);
    const [a, b] = rows.students.map((s) => s.id);
    rows.mistakeLabels = {
      "alg.linear.both-sides|kept-x-sign": "Kept the x term's sign",
      "alg.linear.both-sides|kept-const-sign": "Kept the number's sign",
      "alg.linear.one-step|same-operation": "Did the same operation",
      "alg.linear.two-step|divided-first": "Divided first",
    };
    rows.wrongAnswers.push(
      { studentId: a, skillId: "alg.linear.both-sides", mistakeId: "kept-x-sign", count: 4 },
      { studentId: b, skillId: "alg.linear.both-sides", mistakeId: "kept-x-sign", count: 2 },
      { studentId: a, skillId: "alg.linear.both-sides", mistakeId: "kept-const-sign", count: 3 },
      { studentId: b, skillId: "alg.linear.one-step", mistakeId: "same-operation", count: 2 },
      { studentId: a, skillId: "alg.linear.two-step", mistakeId: "divided-first", count: 1 },
      { studentId: b, skillId: "alg.linear.both-sides", mistakeId: "unknown", count: 3 },
      { studentId: a, skillId: "alg.linear.one-step", mistakeId: null, count: 1 },
    );
    const out = computeImpact(rows, NOW);
    // 16 wrong answers; 12 explained (all but the 3 'unknown' and the 1 without a mistake) → 75%
    expect(out.mistakes).toEqual({
      wrongAnswers: 16,
      explained: 12,
      share: 0.75,
      top: [
        { label: "Kept the x term's sign", count: 6 },
        { label: "Kept the number's sign", count: 3 },
        { label: "Did the same operation", count: 2 },
      ],
    });
  });

  it("mistakes found by the mistake finder: only approved ones that explain at least one real wrong answer", () => {
    const rows = rowsWith([]);
    rows.mined = [
      { label: "Divided by the x number of the left side only", realWrongAnswers: 4 },
      { label: "Found only from test answers", realWrongAnswers: 0 },
    ];
    expect(computeImpact(rows, NOW).miner).toEqual({ count: 1, mistakes: [{ label: "Divided by the x number of the left side only", realWrongAnswers: 4 }] });
  });
});
