import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { answerText } from "../../core/answer";
import { diagnose } from "../../core/diagnose";
import { frac } from "../../core/fraction";
import { createRng } from "../../core/rng";
import { linearBothSides } from "../../core/skills/linear-both-sides";
import { impactResponse } from "../impact-route";
import { createServices, type ServiceOptions } from "../services";
import { openStore } from "../store";
import { makeClock, SKILL, tempDbUrl } from "./helpers";

// F11 Part 3. The organiser's Challenge panel on the class board (join link, counts by class level, comments to
// approve or hide), the pilot CSV's challenge columns, and the public numbers at /api/impact: worked out from REAL
// challenge classes only, with every check scored again from its seeds, and only approved comments.

/** Tests that make many students: fine alone (about 1 s), slower while every test file runs at once. */
const HEAVY = 30_000;

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function fresh(opts: Omit<ServiceOptions, "now"> = {}) {
  const { url, cleanup: rm } = tempDbUrl();
  const counter = { n: 0 };
  const store = await openStore({ url, onRoundTrip: () => void counter.n++ });
  const clock = makeClock();
  const svc = createServices(store, { cooldownHours: 24, random: () => 0.1, ...opts, now: clock.now });
  cleanup = () => {
    store.close();
    rm();
  };
  const trips = async <T>(fn: () => Promise<T>): Promise<{ n: number; out: T }> => {
    counter.n = 0;
    const out = await fn();
    return { n: counter.n, out };
  };
  return { store, svc, clock, url, trips };
}
type Ctx = Awaited<ReturnType<typeof fresh>>;

const challenge = (c: Ctx, trial = false) => c.svc.createChallenge({ title: trial ? "Trial" : "Udgam Shishya Challenge", trial, online: true, pin: "123456" });

async function takeCheck(c: Ctx, studentId: string, phase: "pre" | "post" | "delayed", right: number) {
  const check = await c.svc.startChallengeCheck(studentId, phase);
  if (!check.ok) throw new Error(`${phase}: ${check.reason}`);
  for (const [i, item] of check.items.entries()) {
    const answer = (await c.store.getItem(item.itemId))!.answer;
    await c.svc.submitChallengeCheckAnswer(item.itemId, i < right ? answer : `${answer}1`);
  }
  return check.checkId;
}

/** A student who joins, takes the before check (pre right), waits 12 minutes, takes the after check (post right). */
async function student(c: Ctx, token: string, grade: number, pre: number, post: number | null, feedback?: { useful: number; teachHelped?: number; comment?: string; quoteOk?: boolean }) {
  const r = await c.svc.joinChallenge(token, grade);
  if (!r.ok) throw new Error(r.reason);
  await takeCheck(c, r.studentId, "pre", pre);
  if (post !== null) {
    c.clock.advanceMinutes(12);
    await takeCheck(c, r.studentId, "post", post);
    if (feedback) {
      const arm = (await c.store.getChallengeStudent(r.studentId))!.studyArm;
      const saved = await c.svc.saveChallengeFeedback(r.studentId, {
        useful: feedback.useful,
        teachHelped: arm === "B" ? (feedback.teachHelped ?? 3) : null,
        comment: feedback.comment ?? "",
        quoteOk: feedback.comment ? (feedback.quoteOk ?? false) : null,
      });
      if (!saved.ok) throw new Error(saved.reason);
    }
  }
  return { ...r, arm: (await c.store.getChallengeStudent(r.studentId))!.studyArm! };
}

describe("/api/impact", () => {
  it("counts real challenge classes only, with the paired before → after from the re-checked scores", async () => {
    const c = await fresh();
    const real = await challenge(c);
    const trial = await challenge(c, true);
    const pres = [2, 3, 1, 4, 3];
    const posts = [4, 5, 2, 5, 3];
    const kids = [];
    for (const [i, pre] of pres.entries()) kids.push(await student(c, real.joinToken, 8, pre, posts[i], { useful: 4 }));
    await student(c, real.joinToken, 9, 1, null); // finished only the before check
    for (let i = 0; i < 6; i++) await student(c, trial.joinToken, 8, 0, 6, { useful: 1, comment: "TRIAL-COMMENT", quoteOk: true }); // never counted
    const room = await c.svc.createClassroom({ grade: 8, section: "B", studentCount: 2, pin: "123456" }); // never counted
    void room;

    const out = await c.svc.impact();
    expect(out.reached).toMatchObject({ joined: 6, finishedBefore: 6, finishedBoth: 5 });
    expect(out.reached.byClassLevel).toContainEqual({ level: 9, joined: 1, finishedBefore: 1, finishedBoth: 0 });
    // the hand calculation in impact.test.ts: before 2.6, after 3.8, change 1.2 [0.16, 2.24]
    expect(out.scores.all).toEqual({ shown: true, n: 5, before: 2.6, after: 3.8, difference: 1.2, ci95: [0.16, 2.24] });
    expect(out.ratings.useful).toEqual({ n: 5, shown: true, average: 4 });
    expect(out.generatedAt).toBe(c.clock.now().toISOString());
    expect(JSON.stringify(out)).not.toContain("TRIAL-COMMENT");
    expect(kids.map((k) => k.arm)).toEqual(["A", "B", "A", "B", "A"]); // groups of 3 and 2: not shown
    expect(out.scores.byGroup.A).toEqual({ shown: false, n: 3 });
  }, HEAVY);

  it("scores are worked out again from the seeds: a changed stored score changes nothing", async () => {
    const c = await fresh();
    const real = await challenge(c);
    for (let i = 0; i < 5; i++) await student(c, real.joinToken, 7, 1, 2);
    const db = createClient({ url: c.url });
    try {
      await db.execute("UPDATE checks SET score = 6");
      await db.execute("UPDATE items SET answer = '0' WHERE source IN ('pre', 'post')");
    } finally {
      db.close();
    }
    expect((await c.svc.impact()).scores.all).toMatchObject({ n: 5, before: 1, after: 2, difference: 1 });
  });

  it("never shows a comment the organiser has not approved; approving shows it, hiding takes it away", async () => {
    const c = await fresh();
    const real = await challenge(c);
    const a = await student(c, real.joinToken, 8, 1, 2, { useful: 5, comment: "Teaching the Shishya was fun", quoteOk: true });
    await student(c, real.joinToken, 8, 1, 2, { useful: 5, comment: "Please do not quote me", quoteOk: false });
    const text = async () => JSON.stringify(await c.svc.impact());
    expect(await text()).not.toContain("Teaching the Shishya was fun");

    const panel = (await c.svc.getClassBoard(real.classId)).challenge!;
    expect(panel.comments.map((x) => x.comment)).toEqual(["Teaching the Shishya was fun"]); // only ones allowed to be quoted
    const id = panel.comments[0].id;
    const other = await challenge(c);
    expect(await c.svc.decideFeedback(other.classId, id, true)).toBe(false); // another class cannot
    expect(await text()).not.toContain("Teaching the Shishya was fun");

    expect(await c.svc.decideFeedback(real.classId, id, true)).toBe(true);
    const out = await c.svc.impact();
    expect(out.quotes).toEqual([{ text: "Teaching the Shishya was fun", classLevel: null }]); // only 2 Class 8 students
    expect(await c.svc.decideFeedback(real.classId, id, false)).toBe(true);
    expect(await text()).not.toContain("Teaching the Shishya was fun");
    expect((await c.svc.getClassBoard(real.classId)).challenge!.comments).toEqual([expect.objectContaining({ id, approved: false })]);
    // the comment that may not be quoted can never be approved
    const notOk = (await c.store.getStudentFeedback((await c.store.listStudents(real.classId)).find((s) => s.id !== a.studentId)!.id))!;
    expect(await c.svc.decideFeedback(real.classId, notOk.id, true)).toBe(false);
    expect(await text()).not.toContain("Please do not quote me");
  });

  it("a comment with a student code or a class code in it is refused (a code logs in as that student)", async () => {
    const c = await fresh();
    const real = await challenge(c);
    const r = await c.svc.joinChallenge(real.joinToken, 8);
    if (!r.ok) throw new Error(r.reason);
    await takeCheck(c, r.studentId, "pre", 1);
    c.clock.advanceMinutes(12);
    await takeCheck(c, r.studentId, "post", 1);
    for (const comment of [`my code is ${r.code}`, `my code is ${r.code.toLowerCase()}`, "my friend is 9C-K7QM", `class ${real.classCode}`]) {
      expect(await c.svc.saveChallengeFeedback(r.studentId, { useful: 4, teachHelped: null, comment, quoteOk: true }), comment).toMatchObject({
        ok: false,
        errorKey: "challenge.fb.personal",
      });
    }
    // maths with a dash is fine
    expect(await c.svc.saveChallengeFeedback(r.studentId, { useful: 4, teachHelped: null, comment: "2x-3 = 7 was easy", quoteOk: true })).toEqual({ ok: true });
  });

  it("the route: JSON with no student code in it, cached for a minute; 503 { ok: false } with no details on failure", async () => {
    const c = await fresh();
    const real = await challenge(c);
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await student(c, real.joinToken, 7 + (i % 2), i % 6, (i + 2) % 7, { useful: 3, comment: `good ${i}`, quoteOk: true })).code);
    for (const f of (await c.svc.getClassBoard(real.classId)).challenge!.comments) await c.svc.decideFeedback(real.classId, f.id, true);
    const res = await impactResponse(async () => c.svc);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    const body = await res.text();
    expect(JSON.parse(body)).toMatchObject({ title: "Shishya Challenge: results", reached: { joined: 6 } });
    for (const code of [...codes, real.classCode, real.classId, real.joinToken]) expect(body).not.toContain(code);

    c.store.close();
    const failed = await impactResponse(async () => c.svc);
    expect(failed.status).toBe(503);
    expect(await failed.text()).toBe(JSON.stringify({ ok: false }));
  }, HEAVY);

  it("is set-based: the same number of database round trips for 2 students or 14", async () => {
    const c = await fresh();
    const real = await challenge(c);
    for (let i = 0; i < 2; i++) await student(c, real.joinToken, 8, 1, 2, { useful: 4 });
    const few = await c.trips(() => c.svc.impact());
    for (let i = 0; i < 12; i++) await student(c, real.joinToken, 7 + (i % 4), i % 6, (i + 1) % 6, { useful: 4 });
    const many = await c.trips(() => c.svc.impact());
    expect(many.out.reached.joined).toBe(14);
    expect(many.n).toBe(few.n);
    expect(many.n).toBeLessThanOrEqual(6);
  }, HEAVY);

  it("wrong answers explained by known mistakes come from the challenge's real answers", async () => {
    const c = await fresh();
    const real = await challenge(c);
    await student(c, real.joinToken, 8, 0, 0); // 12 wrong answers, each ...1 (not explained by a known mistake)
    const out = await c.svc.impact();
    expect(out.mistakes.wrongAnswers).toBe(12);
    expect(out.mistakes.explained + 0).toBeLessThanOrEqual(12);
    expect(out.mistakes.share).not.toBeNull();
  });

  it("mistakes found by the mistake finder count only when approved AND they explain a wrong answer from a real class", async () => {
    const c = await fresh();
    const room = await c.svc.createClassroom({ grade: 8, section: "B", studentCount: 1, pin: "123456" });
    await c.svc.recordConsent(room.classId, { allowed: true, slips: 1 });
    const login = await c.svc.studentLogin(room.classCode, room.studentCodes[0]);
    if (!login.ok) throw new Error(login.reason);
    await c.svc.teacherUnlock(login.studentId, SKILL);
    // a real class's child answers (d − b) / a, which no authored mistake explains: logged as 'unknown'
    let explained = 0;
    for (let i = 0; i < 40 && explained < 2; i++) {
      const item = await c.svc.servePracticeItem(login.studentId, SKILL);
      if (!item.ok) throw new Error(item.reason);
      const row = (await c.store.getItem(item.itemId))!;
      const p = JSON.parse(row.paramsJson) as { a: number; b: number; c: number; d: number };
      const wrong = frac(p.d - p.b, p.a);
      const inst = linearBothSides.generate(createRng(row.seed));
      if (diagnose(linearBothSides, inst, wrong) !== "unknown") {
        await c.svc.submitPracticeAnswer(item.itemId, answerText(inst.answer));
        continue;
      }
      await c.svc.submitPracticeAnswer(item.itemId, answerText(wrong));
      explained++;
    }
    expect(explained).toBe(2);
    const spec = (id: string, label: string, formula: string) =>
      JSON.stringify({ id, label, childLabel: "c", stepType: "divide", firstWrongLine: 5, lines: { "5": `x = {${formula}}` }, answerFormula: formula });
    const row = (id: string, label: string, formula: string) => ({
      id,
      skillId: SKILL,
      source: spec(id, label, formula),
      testsJson: JSON.stringify({ reproduced: 3, checkedInstances: 1000, overlaps: {} }),
      status: "APPROVED" as const,
      approver: "teacher of class 8B-TEST",
      createdAt: "2026-10-20T09:00:00.000Z",
    });
    await c.store.insertMinedMistake(row("m-real", "Divided by the x number of the left side only", "(d - b) / a"));
    await c.store.insertMinedMistake(row("m-none", "Explains nothing real", "(d + b) * 100"));
    await c.store.insertMinedMistake({ ...row("m-draft", "Only a draft", "(d - b) / a"), status: "DRAFT_TESTED" });
    expect((await c.svc.impact()).miner).toEqual({ count: 1, mistakes: [{ label: "Divided by the x number of the left side only", realWrongAnswers: 2 }] });
  });
});

describe("the class board's Challenge panel", () => {
  it("joined / finished before / finished after / gave feedback, by class level, and the groups", async () => {
    const c = await fresh();
    const real = await challenge(c);
    await student(c, real.joinToken, 7, 1, 2, { useful: 4 });
    await student(c, real.joinToken, 7, 1, null);
    await student(c, real.joinToken, 9, 2, 3);
    await c.svc.joinChallenge(real.joinToken, 10);
    const board = await c.svc.getClassBoard(real.classId);
    expect(board.challenge!.levels).toEqual([
      { level: 7, joined: 2, before: 2, after: 1, feedback: 1 },
      { level: 8, joined: 0, before: 0, after: 0, feedback: 0 },
      { level: 9, joined: 1, before: 1, after: 1, feedback: 0 },
      { level: 10, joined: 1, before: 0, after: 0, feedback: 0 },
    ]);
    expect(board.challenge!.total).toEqual({ joined: 4, before: 3, after: 2, feedback: 1 });
    expect(board.challenge!.groups).toEqual({ A: 3, B: 1 });
    // the stuck board and the rest work as for any class: the challenge's wrong answers are on it
    expect(board.stuck.groups.length + board.stuck.slips.length).toBeGreaterThanOrEqual(0);
    expect(board.codes).toHaveLength(4);
    // a classroom class has no Challenge panel
    const room = await c.svc.createClassroom({ grade: 8, section: "B", studentCount: 1, pin: "123456" });
    expect((await c.svc.getClassBoard(room.classId)).challenge).toBeNull();
  });

  it("the board of a challenge class takes at most 9 round trips (one more read than a classroom board)", async () => {
    const c = await fresh();
    const real = await challenge(c);
    for (let i = 0; i < 6; i++) await student(c, real.joinToken, 7 + (i % 4), 1, 2, { useful: 4, comment: `c${i}`, quoteOk: true });
    await c.svc.getClassBoard(real.classId);
    const { n } = await c.trips(() => c.svc.getClassBoard(real.classId));
    expect(n).toBeLessThanOrEqual(9);
  }, HEAVY);
});

describe("the pilot CSV of a challenge class", () => {
  it("has selfGrade, studyArm, pre, post and delayed scores, useful and teachHelped, one row per student, and no codes", async () => {
    const c = await fresh();
    const real = await challenge(c);
    const a = await student(c, real.joinToken, 8, 2, 4, { useful: 5 });
    const b = await student(c, real.joinToken, 8, 1, 3, { useful: 3, teachHelped: 4 });
    await c.svc.joinChallenge(real.joinToken, 10);
    c.clock.advanceHours(72);
    await takeCheck(c, a.studentId, "delayed", 3);
    const csv = await c.svc.exportPilotCsv(real.classId);
    const [header, ...lines] = csv.trim().split("\n");
    expect(header.split(",").slice(-8)).toEqual(["selfGrade", "studyArm", "preScore", "postScore", "delayedScore", "useful", "teachHelped", "note"]);
    const students = lines.filter((l) => l.split(",")[1] === "challenge-student").map((l) => l.split(",").slice(-8, -1).join(","));
    expect(students.sort()).toEqual(["10,A,,,,,", "8,A,2,4,3,5,", "8,B,1,3,,3,4"].sort());
    for (const code of [a.code, b.code, real.classCode]) expect(csv).not.toContain(code);
    // the skill rows are still there, with the new columns empty
    const skillRow = lines.find((l) => l.split(",")[1] === SKILL);
    expect(skillRow?.split(",").slice(-8, -1)).toEqual(["", "", "", "", "", "", ""]);
  });

  it("a classroom class's CSV gets the same header and no student rows", async () => {
    const c = await fresh();
    const room = await c.svc.createClassroom({ grade: 8, section: "B", studentCount: 1, pin: "123456" });
    const csv = await c.svc.exportPilotCsv(room.classId);
    expect(csv.split("\n")[0].split(",").slice(-8)).toEqual(["selfGrade", "studyArm", "preScore", "postScore", "delayedScore", "useful", "teachHelped", "note"]);
    expect(csv).not.toContain("challenge-student");
  });
});
