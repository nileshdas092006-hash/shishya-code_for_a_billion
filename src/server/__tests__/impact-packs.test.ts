import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "../../i18n/en";
import { runMiner } from "../../agents/miner";
import { scriptedModel } from "../../agents/fake-model";
import { DET, DICE } from "../../core/challengeCheck";
import { impactResponse } from "../impact-route";
import { COLLEGE_HEADING, COLLEGE_METHOD, COLLEGE_NOTE, computeImpact, SCHOOL_HEADING, type ImpactRows } from "../impact";
import { createMinerPorts, unknownErrors } from "../miner-ports";
import { createServices, type ServiceOptions } from "../services";
import { openStore } from "../store";
import { makeClock, tempDbUrl } from "./helpers";

// F12 Part 3. The college pack's results are their own block ("College pack, first-year college students"), never
// mixed into the school (Classes 7–10) numbers, under the same rules: real classes only, scored again from seeds,
// any average over fewer than 5 not shown, paired and Welch intervals, feedback averages, approved quotes only.

const NOW = new Date("2026-11-08T10:30:00.000Z");
const HEAVY = 60_000;

type S = { pack: "school" | "college"; group: "A" | "B"; pre?: number; post?: number; delayed?: number; classId?: string; grade?: number };

let n = 0;
function rowsWith(spec: S[]): ImpactRows {
  const rows: ImpactRows = {
    classes: [
      { id: "school", kind: "real", mode: "challenge", pack: "school" },
      { id: "college", kind: "real", mode: "challenge", pack: "college" },
      { id: "college-trial", kind: "test", mode: "challenge", pack: "college" },
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
    const college = s.pack === "college";
    rows.students.push({
      id,
      classId: s.classId ?? s.pack,
      code: college ? `UG-Q${String(n).padStart(3, "X")}` : `${s.grade ?? 8}C-Q${String(n).padStart(3, "X")}`,
      selfGrade: college ? null : (s.grade ?? 8),
      studyArm: s.group,
    });
    if (s.pre !== undefined) rows.checks.push({ studentId: id, phase: "pre", score: s.pre });
    if (s.post !== undefined) rows.checks.push({ studentId: id, phase: "post", score: s.post });
    if (s.delayed !== undefined) rows.checks.push({ studentId: id, phase: "delayed", score: s.delayed });
  }
  return rows;
}

const merge = (p: ImpactRows, q: ImpactRows): ImpactRows => ({
  classes: p.classes,
  students: [...p.students, ...q.students],
  checks: [...p.checks, ...q.checks],
  feedback: [...p.feedback, ...q.feedback],
  wrongAnswers: [...p.wrongAnswers, ...q.wrongAnswers],
  mistakeLabels: { ...p.mistakeLabels, ...q.mistakeLabels },
  mined: [...p.mined, ...q.mined],
});

/** The school block alone: everything except the college key. */
const schoolBlock = (out: ReturnType<typeof computeImpact>) => {
  const { college, ...school } = out;
  void college;
  return school;
};

const BEFORE = [2, 3, 1, 4, 3];
const AFTER = [4, 5, 2, 5, 3];
/** Five students with the hand-worked paired interval in impact.test.ts: 2.6 → 3.8, change 1.2 [0.16, 2.24]. */
const fivePaired = (pack: "school" | "college", extra: Partial<S> = {}) => BEFORE.map((pre, i): S => ({ pack, group: i % 2 ? "B" : "A", pre, post: AFTER[i], ...extra }));
const PAIRED_RESULT = { shown: true, n: 5, before: 2.6, after: 3.8, difference: 1.2, ci95: [0.16, 2.24] };

describe("computeImpact: packs never mix", () => {
  it("adding college students changes no school number, and the college block counts only them", () => {
    const school = rowsWith([...fivePaired("school"), { pack: "school", group: "A", pre: 1 }]);
    const college = rowsWith([...fivePaired("college"), { pack: "college", group: "B", pre: 5 }, { pack: "college", group: "A" }]);
    const alone = computeImpact(school, NOW);
    const both = computeImpact(merge(school, college), NOW);
    expect(schoolBlock(both)).toEqual(schoolBlock(alone));
    expect(both.reached).toMatchObject({ joined: 6, finishedBefore: 6, finishedBoth: 5 });
    expect(both.college.reached).toEqual({ joined: 7, finishedBefore: 6, finishedBoth: 5 });
    expect(both.college.scores.all).toEqual(PAIRED_RESULT);
  });

  it("adding school students changes no college number", () => {
    const college = rowsWith(fivePaired("college"));
    const school = rowsWith(fivePaired("school"));
    expect(computeImpact(merge(college, school), NOW).college).toEqual(computeImpact(college, NOW).college);
  });

  it("a college-only database: the school block is empty and says so", () => {
    const out = computeImpact(rowsWith(fivePaired("college")), NOW);
    expect(out.reached).toMatchObject({ joined: 0, finishedBefore: 0, finishedBoth: 0 });
    expect(out.scores.all).toEqual({ shown: false, n: 0 });
    expect(out.college.scores.all).toEqual(PAIRED_RESULT);
  });

  it("school numbers are identical to before for the same rows (a class with no pack is school)", () => {
    const rows = rowsWith(fivePaired("school"));
    const noPack: ImpactRows = { ...rows, classes: rows.classes.filter((c) => c.pack === "school").map(({ id, kind, mode }) => ({ id, kind, mode })) };
    const out = computeImpact(noPack, NOW);
    expect(out.scores.all).toEqual(PAIRED_RESULT);
    expect(schoolBlock(out)).toEqual(schoolBlock(computeImpact(rows, NOW)));
    expect(out.college.reached).toEqual({ joined: 0, finishedBefore: 0, finishedBoth: 0 });
  });

  it("wrong answers and their mistakes are split too", () => {
    const school = rowsWith([{ pack: "school", group: "A" }]);
    const college = rowsWith([{ pack: "college", group: "A" }]);
    school.wrongAnswers.push({ studentId: school.students[0].id, skillId: "alg.linear.both-sides", mistakeId: "m", count: 3 });
    college.wrongAnswers.push({ studentId: college.students[0].id, skillId: DET, mistakeId: "added-the-products", count: 2 }, { studentId: college.students[0].id, skillId: DET, mistakeId: "unknown", count: 2 });
    const rows = merge(school, college);
    rows.mistakeLabels = { "alg.linear.both-sides|m": "School mistake", [`${DET}|added-the-products`]: "Added the two diagonal products" };
    const out = computeImpact(rows, NOW);
    expect(out.mistakes).toEqual({ wrongAnswers: 3, explained: 3, share: 1, top: [{ label: "School mistake", count: 3 }] });
    expect(out.college.mistakes).toEqual({ wrongAnswers: 4, explained: 2, share: 0.5, top: [{ label: "Added the two diagonal products", count: 2 }] });
  });
});

describe("computeImpact: the college block has the same rules", () => {
  it("a college class with 4 finishers hides averages; 5 shows them", () => {
    const four = rowsWith(fivePaired("college").slice(0, 4).map((s) => ({ ...s, delayed: 3 })));
    four.feedback = four.students.map((s) => ({ studentId: s.id, useful: 5, teachHelped: 4, comment: null, quoteOk: false, approved: null }));
    const hidden = computeImpact(four, NOW).college;
    expect(hidden.reached).toEqual({ joined: 4, finishedBefore: 4, finishedBoth: 4 });
    expect(hidden.scores.all).toEqual({ shown: false, n: 4 });
    expect(hidden.scores.byGroup.A).toEqual({ shown: false, n: 2 });
    expect(hidden.scores.byGroup.B).toEqual({ shown: false, n: 2 });
    expect(hidden.scores.byGroup.difference).toEqual({ shown: false });
    expect(hidden.delayed).toEqual({ outOf: 4, n: 4, shown: false });
    expect(hidden.ratings.useful).toEqual({ n: 4, shown: false });
    expect(hidden.ratings.teachHelped).toEqual({ n: 4, shown: false });
    // no number of any kind that a group of 4 would give away (the method note also uses the word, so not that)
    expect(JSON.stringify({ scores: hidden.scores, delayed: hidden.delayed, ratings: hidden.ratings })).not.toMatch(/average|before|after|ci95/);

    const five = computeImpact(rowsWith(fivePaired("college")), NOW).college;
    expect(five.scores.all).toEqual(PAIRED_RESULT);
    expect(five.scores.outOf).toBe(6);
  });

  it("the difference between groups uses Welch's interval: the same hand-checked numbers as the school block", () => {
    const groups = (pack: "school" | "college") => [
      ...[1, 2, 3, 1, 2].map((gain, i): S => ({ pack, group: "A", pre: 1, post: 1 + gain, grade: 7 + (i % 2) })),
      ...[2, 3, 4, 2, 3].map((gain): S => ({ pack, group: "B", pre: 1, post: 1 + gain })),
    ];
    const college = computeImpact(rowsWith(groups("college")), NOW).college.scores.byGroup.difference;
    expect(college).toEqual(computeImpact(rowsWith(groups("school")), NOW).scores.byGroup.difference);
    expect(college).toMatchObject({ shown: true, nA: 5, nB: 5, difference: 1 });
  });

  it("real classes only: a trial college class is never counted", () => {
    const out = computeImpact(rowsWith(fivePaired("college", { classId: "college-trial" })), NOW);
    expect(out.college.reached).toEqual({ joined: 0, finishedBefore: 0, finishedBoth: 0 });
    expect(out.reached).toMatchObject({ joined: 0 });
  });

  it("ratings and the later check are averaged, once there are 5", () => {
    const rows = rowsWith(fivePaired("college", { delayed: 3 }));
    rows.feedback = rows.students.map((s, i) => ({ studentId: s.id, useful: 4, teachHelped: i % 2 ? 5 : null, comment: null, quoteOk: false, approved: null }));
    const out = computeImpact(rows, NOW).college;
    expect(out.delayed).toEqual({ outOf: 4, n: 5, shown: true, average: 3 });
    expect(out.ratings.useful).toEqual({ n: 5, shown: true, average: 4 });
    expect(out.ratings.teachHelped).toEqual({ n: 2, shown: false });
  });

  it("only approved, quotable comments, each in its own block; a quote holding a UG code is left out; no codes or ids anywhere", () => {
    const school = rowsWith([{ pack: "school", group: "A" }]);
    const college = rowsWith([{ pack: "college", group: "A" }, { pack: "college", group: "B" }, { pack: "college", group: "A" }, { pack: "college", group: "B" }]);
    const fb = (studentId: string, comment: string, quoteOk: boolean, approved: boolean | null) => ({ studentId, useful: 4, teachHelped: null, comment, quoteOk, approved });
    school.feedback.push(fb(school.students[0].id, "SCHOOL-QUOTE", true, true));
    college.feedback.push(
      fb(college.students[0].id, "COLLEGE-QUOTE", true, true),
      fb(college.students[1].id, "NOT-DECIDED", true, null),
      fb(college.students[2].id, "NO-PERMISSION", false, true),
      fb(college.students[3].id, `Mine is ${college.students[0].code.toLowerCase()}`, true, true),
    );
    const out = computeImpact(merge(school, college), NOW);
    expect(out.quotes).toEqual([{ text: "SCHOOL-QUOTE", classLevel: null }]);
    expect(out.college.quotes).toEqual([{ text: "COLLEGE-QUOTE" }]);
    const json = JSON.stringify(out);
    for (const hidden of ["NOT-DECIDED", "NO-PERMISSION"]) expect(json).not.toContain(hidden);
    for (const s of [...school.students, ...college.students]) {
      expect(json).not.toContain(s.code);
      expect(json).not.toContain(s.id);
    }
  });

  it("the headings and notes are fixed, and the page says exactly what the JSON says", () => {
    const out = computeImpact(rowsWith([]), NOW);
    expect(out.heading).toBe(SCHOOL_HEADING);
    expect(out.college.heading).toBe("College pack (first-year college students, 2×2 determinants and two-dice probability)");
    expect(out.college.note).toBe("The same engine and the same checks, on two college topics, to test that Shishya's Skill Specification works beyond school algebra.");
    expect(out.college.method).toBe(COLLEGE_METHOD);
    expect(en["impact.school.heading"]).toBe(SCHOOL_HEADING);
    expect(en["impact.college.heading"]).toBe(COLLEGE_HEADING);
    expect(en["impact.college.note"]).toBe(COLLEGE_NOTE);
    expect(en["impact.college.method"]).toBe(COLLEGE_METHOD);
    // the school block comes first
    const keys = Object.keys(out);
    expect(keys.indexOf("scores")).toBeLessThan(keys.indexOf("college"));
  });
});

// ---------------------------------------------------------------- through the services

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function fresh(opts: Omit<ServiceOptions, "now"> = {}) {
  const { url, cleanup: rm } = tempDbUrl();
  const store = await openStore({ url });
  const clock = makeClock();
  const svc = createServices(store, { cooldownHours: 24, random: () => 0.1, ...opts, now: clock.now });
  cleanup = () => {
    store.close();
    rm();
  };
  return { store, svc, clock };
}
type Ctx = Awaited<ReturnType<typeof fresh>>;

const link = (c: Ctx, pack: "school" | "college", trial = false) => c.svc.createChallenge({ title: "A challenge", trial, online: true, pin: "123456", pack });

async function takeCheck(c: Ctx, studentId: string, phase: "pre" | "post", right: number) {
  const check = await c.svc.startChallengeCheck(studentId, phase);
  if (!check.ok) throw new Error(`${phase}: ${check.reason}`);
  for (const [i, item] of check.items.entries()) {
    const answer = (await c.store.getItem(item.itemId))!.answer;
    await c.svc.submitChallengeCheckAnswer(item.itemId, i < right ? answer : `${answer}1`);
  }
}

/** A student who joins, takes both checks (the practise step is skipped after 12 minutes) and gives feedback. */
async function student(c: Ctx, token: string, grade: number, pre: number, post: number, useful: number) {
  const r = await c.svc.joinChallenge(token, grade);
  if (!r.ok) throw new Error(r.reason);
  const start = c.clock.t;
  await takeCheck(c, r.studentId, "pre", pre);
  c.clock.advanceMinutes(12);
  await takeCheck(c, r.studentId, "post", post);
  const teaches = (await c.store.getChallengeStudent(r.studentId))?.studyArm === "B";
  const saved = await c.svc.saveChallengeFeedback(r.studentId, { useful, teachHelped: teaches ? 5 : null, comment: "", quoteOk: null });
  if (!saved.ok) throw new Error(saved.reason);
  c.clock.t = start;
  return r;
}

describe("the whole way through: /impact and /api/impact", () => {
  it("real college and school classes in their own blocks, each re-scored from seeds; a trial college class in neither", async () => {
    const c = await fresh();
    const college = await link(c, "college");
    const school = await link(c, "school");
    const trial = await link(c, "college", true);
    for (let i = 0; i < 5; i++) await student(c, college.joinToken, 0, BEFORE[i], AFTER[i], 4);
    await student(c, school.joinToken, 8, 1, 2, 3);
    await student(c, trial.joinToken, 0, 6, 6, 1);

    const out = await c.svc.impact();
    expect(out.college.reached).toEqual({ joined: 5, finishedBefore: 5, finishedBoth: 5 });
    expect(out.college.scores.all).toEqual(PAIRED_RESULT);
    expect(out.college.ratings.useful).toEqual({ n: 5, shown: true, average: 4 });
    expect(out.reached).toMatchObject({ joined: 1, finishedBefore: 1, finishedBoth: 1 });
    expect(out.scores.all).toEqual({ shown: false, n: 1 });
    expect(out.ratings.useful).toEqual({ n: 1, shown: false });

    const response = await impactResponse(async () => c.svc);
    const body = await response.json();
    expect(body.college.heading).toBe(COLLEGE_HEADING);
    expect(body.college.scores.all).toEqual(PAIRED_RESULT);
    expect(body.heading).toBe(SCHOOL_HEADING);
    expect(Object.keys(body).indexOf("reached")).toBeLessThan(Object.keys(body).indexOf("college"));
  }, HEAVY);

  it("the mistakes a college check explains are counted with the college mistakes' own labels", async () => {
    const c = await fresh();
    const college = await link(c, "college");
    const r = await c.svc.joinChallenge(college.joinToken, 0);
    if (!r.ok) throw new Error(r.reason);
    const check = await c.svc.startChallengeCheck(r.studentId, "pre");
    if (!check.ok) throw new Error(check.reason);
    const { getSkillEntry } = await import("../../core/skills");
    const { createRng } = await import("../../core/rng");
    const { answerText } = await import("../../core/answer");
    for (const item of check.items) {
      const stored = (await c.store.getItem(item.itemId))!;
      const entry = getSkillEntry(stored.skillId)!;
      const wrong = entry.spec.mistakes[0].apply(entry.spec.generate(createRng(stored.seed))).answer;
      await c.svc.submitChallengeCheckAnswer(item.itemId, answerText(wrong));
    }
    const out = await c.svc.impact();
    expect(out.college.mistakes).toMatchObject({ wrongAnswers: 6, explained: 6, share: 1 });
    expect(out.college.mistakes.top.map((m) => m.label).sort()).toEqual(["Added the two diagonal products: ad + bc", "Treated the 11 possible sums as equally likely"]);
    expect(out.mistakes.wrongAnswers).toBe(0);
  }, HEAVY);
});

describe("the pilot CSV", () => {
  it("has a pack column on every row; a college class's students have no class level and no grade", async () => {
    const c = await fresh();
    const college = await link(c, "college");
    const r = await student(c, college.joinToken, 0, 3, 6, 5);
    const csv = await c.svc.exportPilotCsv(college.classId);
    const [header, ...lines] = csv.trim().split("\n").map((l) => l.split(","));
    expect(header).toContain("pack");
    expect(header.slice(-8)).toEqual(["selfGrade", "studyArm", "preScore", "postScore", "delayedScore", "useful", "teachHelped", "note"]);
    const col = header.indexOf("pack");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line).toHaveLength(header.length);
      expect(line[col]).toBe("college");
      expect(line[0]).toBe(""); // not "7": a college class has no school grade
    }
    const row = lines.find((l) => l[1] === "challenge-student")!;
    expect(row.slice(-8, -1)).toEqual(["", "A", "3", "6", "", "5", ""]);
    for (const code of [r.code, college.classCode]) expect(csv).not.toContain(code);
    expect(lines.filter((l) => l[1] !== "challenge-student").map((l) => l[1]).sort()).toEqual([DET, DICE].sort());
  }, HEAVY);

  it("says school for a school challenge and a classroom", async () => {
    const c = await fresh();
    const school = await link(c, "school");
    await student(c, school.joinToken, 9, 1, 2, 4);
    const room = await c.svc.createClassroom({ grade: 8, section: "B", studentCount: 1, pin: "123456" });
    for (const classId of [school.classId, room.classId]) {
      const [header, ...lines] = (await c.svc.exportPilotCsv(classId)).trim().split("\n").map((l) => l.split(","));
      const col = header.indexOf("pack");
      for (const line of lines) {
        expect(line).toHaveLength(header.length);
        expect(line[col]).toBe("school");
      }
    }
    const [, row] = (await c.svc.exportPilotCsv(school.classId)).trim().split("\n").map((l) => l.split(","));
    expect(row[0]).toBe("7");
  }, HEAVY);
});

describe("what the organiser of a college class reads", () => {
  it("no line about under-13s or parents on the board", () => {
    for (const key of ["board.challenge.noAi.college", "board.challenge.consent.college", "board.challenge.pack.college"]) expect(en[key], key).not.toMatch(/13|parent/i);
    const board = readFileSync(join(__dirname, "..", "..", "app", "teacher", "[class]", "ClassBoardView.tsx"), "utf8");
    expect(board).toContain('cls.pack === "college" ? "board.challenge.noAi.college" : "board.challenge.noAi"');
    expect(board).toContain('cls.pack === "college" ? "board.challenge.consent.college" : "board.challenge.consent"');
  });
});

describe("the Misconception Miner stays school-only", () => {
  it("refuses a college skill with a clear message (the determinant has a, b, c, d too, so its own check would not stop it)", async () => {
    const c = await fresh();
    for (const skillId of [DET, DICE]) {
      await expect(runMiner({ model: scriptedModel([]), ports: createMinerPorts(c.store), skillId })).rejects.toThrow(/school algebra/);
    }
  });

  it("college answers nobody can explain are still logged per skill, from real classes only", async () => {
    const c = await fresh();
    const real = await link(c, "college");
    const trial = await link(c, "college", true);
    for (const token of [real.joinToken, trial.joinToken]) {
      const r = await c.svc.joinChallenge(token, 0);
      if (!r.ok) throw new Error(r.reason);
      const item = await c.svc.servePracticeItem(r.studentId, DET);
      if (!item.ok) throw new Error(item.reason);
      await c.svc.submitPracticeAnswer(item.itemId, "99999");
    }
    expect((await unknownErrors(c.store, DET)).map((e) => e.wrongAnswer)).toEqual(["99999"]);
    expect(await unknownErrors(c.store, DICE)).toEqual([]);
  });
});
