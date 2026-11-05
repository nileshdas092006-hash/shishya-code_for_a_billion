import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { DET, DICE, PACK_CHECK_PLANS } from "../../core/challengeCheck";
import { COLLEGE_SKILLS, getSkillEntry, SKILLS } from "../../core/skills";
import { createRng } from "../../core/rng";
import { commentProblem } from "../challenge";
import { createServices, type ServiceOptions } from "../services";
import { openStore } from "../store";
import { makeClock, SKILL, tempDbUrl } from "./helpers";

// F12 Part 2. The college challenge: the same machinery on a second pack. A college-pack class has its own link, asks
// no class level, gives codes like UG-K7QM, alternates groups within the class from a random start, and shows its
// students only the two college skills; a school student never sees them. The school challenge is covered, unchanged,
// by challenge-join.test.ts and challenge-flow.test.ts.

const HEAVY = 30_000;
const COLLEGE_IDS = COLLEGE_SKILLS.map((s) => s.spec.id);
const SCHOOL_IDS = SKILLS.map((s) => s.spec.id);

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
  const college = await svc.createChallenge({ title: "IITG first-years", trial: false, online: true, pin: "123456", pack: "college" });
  const school = await svc.createChallenge({ title: "Udgam Shishya Challenge", trial: false, online: true, pin: "123456" });
  const trips = async <T>(fn: () => Promise<T>): Promise<{ n: number; out: T }> => {
    counter.n = 0;
    const out = await fn();
    return { n: counter.n, out };
  };
  return { store, svc, clock, college, school, url, trips };
}

type Ctx = Awaited<ReturnType<typeof fresh>>;

async function joinCollege(c: Ctx) {
  const r = await c.svc.joinChallenge(c.college.joinToken, 0);
  if (!r.ok) throw new Error(r.reason);
  return r;
}
async function joinSchool(c: Ctx, grade = 8) {
  const r = await c.svc.joinChallenge(c.school.joinToken, grade);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

/** A college student of each group (the class starts with A: random() < 0.5). */
async function bothGroups(c: Ctx) {
  const a = (await joinCollege(c)).studentId;
  const b = (await joinCollege(c)).studentId;
  expect((await c.store.getChallengeStudent(a))?.studyArm).toBe("A");
  expect((await c.store.getChallengeStudent(b))?.studyArm).toBe("B");
  return { a, b };
}

async function takeCheck(c: Ctx, studentId: string, phase: "pre" | "post" | "delayed", right: number) {
  const check = await c.svc.startChallengeCheck(studentId, phase);
  if (!check.ok) throw new Error(`${phase}: ${check.reason}`);
  const outs = [];
  for (const [i, item] of check.items.entries()) {
    const answer = (await c.store.getItem(item.itemId))!.answer;
    outs.push(await c.svc.submitChallengeCheckAnswer(item.itemId, i < right ? answer : `${answer}1`));
  }
  return { check, last: outs.at(-1)! };
}

async function practise(c: Ctx, studentId: string, skillId: string, n: number) {
  for (let i = 0; i < n; i++) {
    const item = await c.svc.servePracticeItem(studentId, skillId);
    if (!item.ok) throw new Error(item.reason);
    await c.svc.submitPracticeAnswer(item.itemId, (await c.store.getItem(item.itemId))!.answer);
  }
}

/** One teach session on a skill, fixing every trace on the first try, with the correct line worked out by src/core. */
async function teach(c: Ctx, studentId: string, skillId: string) {
  const spec = getSkillEntry(skillId)!.spec;
  const session = await c.svc.startTeach(studentId, skillId);
  if (!session.ok) throw new Error(session.reason);
  let last;
  for (const t of session.traces) {
    const item = (await c.store.getItem(t.itemId))!;
    const inst = spec.generate(createRng(item.seed));
    const line = spec.mistakes.find((m) => m.id === item.mistakeId)!.apply(inst).firstWrongLine;
    last = await c.svc.submitTeachStep(t.itemId, line, spec.solve(inst).trace[line - 1].text);
  }
  return { session, last: last! };
}

const overview = async (c: Ctx, studentId: string) => {
  const o = await c.svc.challengeOverview(studentId);
  if (!o.ok) throw new Error(o.reason);
  return o;
};

describe("creating the link", () => {
  it("a college-pack class; a challenge with no pack chosen is school, and so is every other class", async () => {
    const c = await fresh();
    expect(await c.svc.getClass(c.college.classId)).toMatchObject({ pack: "college", mode: "challenge", aiAllowed: false });
    expect(await c.svc.getClass(c.school.classId)).toMatchObject({ pack: "school", mode: "challenge" });
    const room = await c.svc.createClassroom({ grade: 8, section: "B", studentCount: 1, pin: "123456" });
    expect(await c.svc.getClass(room.classId)).toMatchObject({ pack: "school" });
    expect(await c.svc.challengeByToken(c.college.joinToken)).toMatchObject({ pack: "college", title: "IITG first-years" });
    expect(await c.svc.challengeByToken(c.school.joinToken)).toMatchObject({ pack: "school" });
  });

  it("the column is added to an old database with DEFAULT 'school': old rows keep working, and running twice is safe", async () => {
    const c = await fresh();
    const student = await joinSchool(c);
    c.store.close();
    const old = createClient({ url: c.url });
    await old.execute("ALTER TABLE classes DROP COLUMN pack");
    old.close();
    const again = await openStore({ url: c.url });
    const svc = createServices(again, { now: c.clock.now, cooldownHours: 24 });
    expect(await svc.getClass(c.school.classId)).toMatchObject({ pack: "school" });
    expect(await svc.getClass(c.college.classId)).toMatchObject({ pack: "school" }); // it can only be what the default says
    expect((await svc.getSkillMap(student.studentId)).map((s) => s.skillId)).toEqual(SCHOOL_IDS);
    again.close();
    const twice = await openStore({ url: c.url });
    expect(await twice.getClass(c.school.classId)).toMatchObject({ pack: "school" });
    twice.close();
    cleanup = undefined; // the store is already closed
  });
});

describe("joining with a college link", () => {
  it("asks no class level: selfGrade is NULL, whatever was sent, and the code looks like UG-K7QM", async () => {
    const c = await fresh();
    for (const sent of [0, 9, Number.NaN]) {
      const r = await c.svc.joinChallenge(c.college.joinToken, sent);
      if (!r.ok) throw new Error(r.reason);
      expect(r.code).toMatch(/^UG-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
      expect(await c.store.getChallengeStudent(r.studentId)).toMatchObject({ selfGrade: null });
      expect(await c.svc.getStudentContext(r.studentId)).toMatchObject({ classMode: "challenge", classPack: "college", selfGrade: null, aiAllowed: false });
    }
  });

  it("a school link still needs a class level, and its codes are as before", async () => {
    const c = await fresh();
    expect(await c.svc.joinChallenge(c.school.joinToken, 0)).toMatchObject({ ok: false, code: "bad_request" });
    expect((await joinSchool(c, 9)).code).toMatch(/^9C-/);
  });

  it("a UG code logs in with the class code", async () => {
    const c = await fresh();
    const r = await joinCollege(c);
    expect(await c.svc.studentLogin(r.classCode, r.code)).toEqual({ ok: true, studentId: r.studentId });
    expect(await c.svc.studentLogin(r.classCode, r.code.toLowerCase())).toEqual({ ok: true, studentId: r.studentId });
  });

  it(
    "groups alternate within the class from a random start (the database's NULL level does not stop them alternating)",
    async () => {
      const startA = await fresh({ random: () => 0.1 });
      const armsA = [];
      for (let i = 0; i < 6; i++) armsA.push((await startA.store.getChallengeStudent((await joinCollege(startA)).studentId))?.studyArm);
      expect(armsA).toEqual(["A", "B", "A", "B", "A", "B"]);
      const startB = await fresh({ random: () => 0.9 });
      const armsB = [];
      for (let i = 0; i < 4; i++) armsB.push((await startB.store.getChallengeStudent((await joinCollege(startB)).studentId))?.studyArm);
      expect(armsB).toEqual(["B", "A", "B", "A"]);
    },
    HEAVY,
  );
});

describe("a student only ever sees their own pack", () => {
  it("a college student's skill map: the two college skills, open; no school skill gets a row", async () => {
    const c = await fresh();
    const { studentId } = await joinCollege(c);
    expect(await c.svc.getSkillMap(studentId)).toEqual(COLLEGE_IDS.map((skillId) => ({ skillId, state: "OPEN", recheck: null })));
    expect((await c.store.listMastery({ studentId })).map((r) => r.skillId).sort()).toEqual([...COLLEGE_IDS].sort());
  });

  it("a school student's skill map: the school skills; no college skill gets a row", async () => {
    const c = await fresh();
    const room = await c.svc.createClassroom({ grade: 8, section: "B", studentCount: 1, pin: "123456" });
    await c.svc.recordConsent(room.classId, { allowed: true, slips: 1 });
    const login = await c.svc.studentLogin(room.classCode, room.studentCodes[0]);
    if (!login.ok) throw new Error(login.reason);
    const { studentId: joined } = await joinSchool(c);
    for (const id of [login.studentId, joined]) {
      expect((await c.svc.getSkillMap(id)).map((s) => s.skillId)).toEqual(SCHOOL_IDS);
      for (const row of await c.store.listMastery({ studentId: id })) expect(SCHOOL_IDS).toContain(row.skillId);
    }
  });

  it("a college student cannot open a school skill, and nothing is written", async () => {
    const c = await fresh();
    const { studentId } = await joinCollege(c);
    const rows = await c.store.listMastery({ studentId });
    expect(await c.svc.getState(studentId, SKILL)).toBe("LOCKED");
    expect(await c.svc.servePracticeItem(studentId, SKILL)).toMatchObject({ ok: false, code: "locked" });
    expect(await c.svc.startTeach(studentId, SKILL)).toMatchObject({ ok: false, code: "locked" });
    expect(await c.svc.startProof(studentId, SKILL)).toMatchObject({ ok: false, code: "locked" });
    expect(await c.svc.proofStatus(studentId, SKILL)).toMatchObject({ canStart: false, code: "locked" });
    expect(await c.svc.teacherUnlock(studentId, SKILL)).toBe("LOCKED");
    expect(await c.store.listMastery({ studentId })).toEqual(rows);
    expect(await c.store.listItems({ studentId, skillId: SKILL })).toEqual([]);
  });

  it("a school student cannot open a college skill, in a challenge or a classroom, and nothing is written", async () => {
    const c = await fresh();
    const room = await c.svc.createClassroom({ grade: 9, section: "B", studentCount: 1, pin: "123456" });
    await c.svc.recordConsent(room.classId, { allowed: true, slips: 1 });
    const login = await c.svc.studentLogin(room.classCode, room.studentCodes[0]);
    if (!login.ok) throw new Error(login.reason);
    const { studentId: joined } = await joinSchool(c);
    for (const studentId of [login.studentId, joined]) {
      const rows = await c.store.listMastery({ studentId });
      for (const skillId of COLLEGE_IDS) {
        expect(await c.svc.getState(studentId, skillId)).toBe("LOCKED");
        expect(await c.svc.servePracticeItem(studentId, skillId)).toMatchObject({ ok: false, code: "locked" });
        expect(await c.svc.startTeach(studentId, skillId)).toMatchObject({ ok: false, code: "locked" });
        expect(await c.svc.startProof(studentId, skillId)).toMatchObject({ ok: false, code: "locked" });
        expect(await c.svc.teacherUnlock(studentId, skillId)).toBe("LOCKED");
      }
      expect(await c.store.listMastery({ studentId })).toEqual(rows);
    }
  });

  it("a college student can work on a college skill as usual: practise, teach, show it alone", async () => {
    const c = await fresh();
    const { studentId } = await joinCollege(c);
    expect(await c.svc.getState(studentId, DET)).toBe("OPEN");
    await practise(c, studentId, DET, 2);
    const { session, last } = await teach(c, studentId, DET);
    expect(session.traces).toHaveLength(3);
    expect(last).toMatchObject({ ok: true, state: "KEY1" });
    const proof = await c.svc.startProof(studentId, DET);
    if (!proof.ok) throw new Error(proof.reason);
    expect(proof.items.map((i) => i.format)).toEqual(["solve", "solve", "solve", "apply"]);
    let out;
    for (const i of proof.items) out = await c.svc.submitProofAnswer(i.itemId, (await c.store.getItem(i.itemId))!.answer);
    expect(out).toMatchObject({ ok: true, finished: true, passed: true, state: "MASTERED" });
  }, HEAVY);

  it("the Ready check is not offered to a college student (it is school whole-number sums)", async () => {
    const c = await fresh();
    const { studentId } = await joinCollege(c);
    expect(await c.svc.startReadyCheck(studentId)).toMatchObject({ ok: false, code: "locked" });
    const school = await joinSchool(c);
    expect(await c.svc.startReadyCheck(school.studentId)).toMatchObject({ ok: true });
  });

  it("the tour and classroom unlocks stay school: a college skill cannot be unlocked for a classroom, and a school one not for a college class", async () => {
    const c = await fresh();
    const room = await c.svc.createClassroom({ grade: 8, section: "B", studentCount: 2, pin: "123456" });
    expect(await c.svc.teacherUnlockClass(room.classId, DET)).toBe(0);
    await joinCollege(c);
    expect(await c.svc.teacherUnlockClass(c.college.classId, SKILL)).toBe(0);
    const tour = await c.svc.startTour();
    if (!tour.ok) throw new Error(tour.reason);
    expect((await c.svc.getSkillMap(tour.studentId)).map((s) => s.skillId)).toEqual(SCHOOL_IDS);
  }, HEAVY);

  it("worksheets and the projector stay in the class's own pack", async () => {
    const c = await fresh();
    const room = await c.svc.createClassroom({ grade: 8, section: "B", studentCount: 1, pin: "123456" });
    expect(await c.svc.createWorksheet(room.classId, DET)).toMatchObject({ ok: false, code: "bad_request" });
    expect(await c.svc.createWorksheet(c.college.classId, SKILL)).toMatchObject({ ok: false, code: "bad_request" });
    expect(await c.svc.createWorksheet(c.college.classId, DET)).toMatchObject({ ok: true });
    await expect(c.svc.projectorTrace(room.classId, DET)).rejects.toThrow();
    await expect(c.svc.projectorTrace(c.college.classId, SKILL)).rejects.toThrow();
    expect((await c.svc.projectorTrace(c.college.classId, DET)).question).toMatch(/^\[\[/);
  });
});

describe("the board of a college class", () => {
  it("shows the college skills only, no class-level rows, and no drafts of school mistakes", async () => {
    const c = await fresh();
    await bothGroups(c);
    const board = await c.svc.getClassBoard(c.college.classId);
    expect(board.progress.map((p) => p.skillId)).toEqual(COLLEGE_IDS);
    expect(board.progress[0].counts).toMatchObject({ OPEN: 2 });
    expect(board.stuck.grid.rows.map((r) => r.skillId)).toEqual(COLLEGE_IDS);
    expect(board.mined).toEqual([]);
    expect(board.challenge).toMatchObject({ pack: "college", levels: [], total: { joined: 2 }, groups: { A: 1, B: 1 } });
    expect(board.numberBasics).toEqual([]);
  });

  it("a school challenge's board is as before", async () => {
    const c = await fresh();
    await joinSchool(c, 7);
    const board = await c.svc.getClassBoard(c.school.classId);
    expect(board.progress.map((p) => p.skillId)).toEqual(SCHOOL_IDS);
    expect(board.challenge?.levels.map((l) => l.level)).toEqual([7, 8, 9, 10]);
    expect(board.challenge).toMatchObject({ pack: "school", total: { joined: 1 } });
  });
});

describe("the college checks", () => {
  it("before: 3 determinants + 3 dice; after: the same mix, all new; later: 2 + 2, all new; each scored from its seeds", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    const pre = await takeCheck(c, a, "pre", 3);
    const skillsOf = async (itemIds: string[]) => (await c.store.getItems(itemIds)).map((i) => [i.id, i.skillId] as const);
    const planOf = async (check: typeof pre.check) => {
      const skills = new Map(await skillsOf(check.items.map((i) => i.itemId)));
      return check.items.map((i) => skills.get(i.itemId));
    };
    expect(await planOf(pre.check)).toEqual(PACK_CHECK_PLANS.college.pre);
    expect(pre.last).toMatchObject({ ok: true, finished: true, phase: "pre", score: 3, total: 6 });

    await practise(c, a, DET, 4);
    await practise(c, a, DICE, 4);
    const post = await takeCheck(c, a, "post", 6);
    expect(await planOf(post.check)).toEqual(PACK_CHECK_PLANS.college.post);
    expect(post.last).toMatchObject({ ok: true, finished: true, phase: "post", score: 6, total: 6, before: 3 });

    const texts = (check: typeof pre.check) => check.items.map((i) => i.text);
    expect(texts(post.check).filter((t) => texts(pre.check).includes(t))).toEqual([]);

    expect(await c.svc.saveChallengeFeedback(a, { useful: 5, teachHelped: null, comment: "", quoteOk: null })).toEqual({ ok: true });
    c.clock.advanceHours(72);
    const delayed = await takeCheck(c, a, "delayed", 2);
    expect(await planOf(delayed.check)).toEqual(PACK_CHECK_PLANS.college.delayed);
    expect(delayed.last).toMatchObject({ ok: true, finished: true, phase: "delayed", score: 2, total: 4 });
    expect(texts(delayed.check).filter((t) => [...texts(pre.check), ...texts(post.check)].includes(t))).toEqual([]);
  }, HEAVY);

  it("checks never write mastery and are never a proof run", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    const before = await c.store.listMastery({ studentId: a });
    await takeCheck(c, a, "pre", 6);
    expect(await c.store.listMastery({ studentId: a })).toEqual(before);
    expect(await c.store.getOpenProofRun(a, DET)).toBeUndefined();
  });

  it("a right answer in any form counts: a dice fraction need not be in its simplest form", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    const check = await c.svc.startChallengeCheck(a, "pre");
    if (!check.ok) throw new Error(check.reason);
    let last;
    for (const item of check.items) {
      const stored = (await c.store.getItem(item.itemId))!;
      const [num, den = "1"] = stored.answer.split("/");
      last = await c.svc.submitChallengeCheckAnswer(item.itemId, `${Number(num) * 2}/${Number(den) * 2}`);
    }
    expect(last).toMatchObject({ finished: true, score: 6 });
  });

  it("a student who has practised every dice question can still take a check: it never repeats an earlier check's question", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    const pre = await takeCheck(c, a, "pre", 6);
    const seen = new Set<string>();
    for (let i = 0; i < 300 && seen.size < 27; i++) {
      const item = await c.svc.servePracticeItem(a, DICE);
      if (!item.ok) throw new Error(item.reason);
      seen.add(item.text);
      await c.svc.submitPracticeAnswer(item.itemId, (await c.store.getItem(item.itemId))!.answer);
    }
    expect(seen.size).toBeGreaterThanOrEqual(24); // the other 3 were in the before check, or practice repeats them
    await practise(c, a, DET, 4);
    const post = await c.svc.startChallengeCheck(a, "post");
    if (!post.ok) throw new Error(post.reason);
    const preTexts = pre.check.items.map((i) => i.text);
    expect(post.items.map((i) => i.text).filter((t) => preTexts.includes(t))).toEqual([]);
  }, HEAVY);
});

describe("the college practise step: equal work", () => {
  it("group A: 4 determinants + 4 dice, and no teaching", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    await takeCheck(c, a, "pre", 3);
    let o = await overview(c, a);
    expect(o.step).toBe("practise");
    expect(o.teach).toBe(false);
    expect(o.college).toBe(true);
    expect(o.practise).toMatchObject({ target: 8, done: 0, ready: false, sets: [{ skillId: DET, target: 4, done: 0 }, { skillId: DICE, target: 4, done: 0 }] });
    expect(await c.svc.startChallengeCheck(a, "post")).toMatchObject({ ok: false, code: "not_ready" });
    await practise(c, a, DET, 4);
    await practise(c, a, DICE, 3);
    o = await overview(c, a);
    expect(o.practise).toMatchObject({ done: 7, ready: false, sets: [{ done: 4 }, { done: 3 }] });
    await practise(c, a, DICE, 1);
    expect((await overview(c, a)).practise).toMatchObject({ target: 8, done: 8, ready: true });
  }, HEAVY);

  it("extra answers on one skill never make up for the other", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    await takeCheck(c, a, "pre", 3);
    await practise(c, a, DET, 8);
    expect((await overview(c, a)).practise).toMatchObject({ done: 8, ready: false });
  }, HEAVY);

  it("group B: 2 determinants + 2 dice, then teach the Shishya once on determinants (3 traces)", async () => {
    const c = await fresh();
    const { b } = await bothGroups(c);
    await takeCheck(c, b, "pre", 3);
    let o = await overview(c, b);
    expect(o.teach).toBe(true);
    expect(o.practise).toMatchObject({ target: 4, teachSkill: DET, sets: [{ skillId: DET, target: 2 }, { skillId: DICE, target: 2 }] });
    await practise(c, b, DET, 2);
    await practise(c, b, DICE, 2);
    o = await overview(c, b);
    expect(o.practise).toMatchObject({ done: 4, teachStarted: false, teachDone: false, ready: false });
    const { session, last } = await teach(c, b, DET);
    expect(session.traces).toHaveLength(3);
    // KEY1 comes only from the normal teach rule, in mastery.ts
    expect(last).toMatchObject({ ok: true, state: "KEY1" });
    expect((await overview(c, b)).practise).toMatchObject({ teachStarted: true, teachDone: true, ready: true });
    expect(await takeCheck(c, b, "post", 5).then((p) => p.last)).toMatchObject({ phase: "post", score: 5, before: 3 });
    expect(await c.svc.saveChallengeFeedback(b, { useful: 5, teachHelped: null, comment: "", quoteOk: null })).toMatchObject({ ok: false, code: "bad_request" });
    expect(await c.svc.saveChallengeFeedback(b, { useful: 5, teachHelped: 4, comment: "", quoteOk: null })).toEqual({ ok: true });
    expect((await overview(c, b)).step).toBe("done");
  }, HEAVY);

  it("anyone may go on after 12 minutes", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    await takeCheck(c, a, "pre", 3);
    c.clock.advanceMinutes(11);
    expect((await overview(c, a)).practise).toMatchObject({ ready: false, skipInSeconds: 60 });
    c.clock.advanceMinutes(1);
    expect((await overview(c, a)).practise).toMatchObject({ ready: true, skipInSeconds: 0 });
    expect(await c.svc.startChallengeCheck(a, "post")).toMatchObject({ ok: true });
  });

  it("the school plan is exactly as before: no sets in what the screen is sent", async () => {
    const c = await fresh();
    const first = (await joinSchool(c, 8)).studentId;
    await takeCheck(c, first, "pre", 3);
    const o = await overview(c, first);
    expect(o.college).toBeUndefined();
    expect(o.practise).toEqual({ target: 8, done: 0, teachStarted: false, teachDone: false, ready: false, skipInSeconds: 720 });
  });
});

describe("the end-of-challenge card: before → after and the time taken, for both packs", () => {
  it("the time runs from the start of the before check to the end of the after check", async () => {
    const c = await fresh();
    for (const studentId of [(await joinCollege(c)).studentId, (await joinSchool(c, 9)).studentId]) {
      expect((await overview(c, studentId)).minutesTaken).toBeUndefined();
      await takeCheck(c, studentId, "pre", 3);
      c.clock.advanceMinutes(12); // anyone may go on after 12 minutes
      expect((await overview(c, studentId)).minutesTaken).toBeUndefined();
      c.clock.advanceMinutes(5);
      const post = await c.svc.startChallengeCheck(studentId, "post");
      if (!post.ok) throw new Error(post.reason);
      c.clock.advanceMinutes(3);
      let last;
      for (const item of post.items) last = await c.svc.submitChallengeCheckAnswer(item.itemId, (await c.store.getItem(item.itemId))!.answer);
      expect(last).toMatchObject({ finished: true, phase: "post", score: 6, before: 3, total: 6, minutes: 20 });
      expect((await overview(c, studentId)).minutesTaken).toBe(20);
    }
  }, HEAVY);

  it("a check that is not the after check carries no time", async () => {
    const c = await fresh();
    const { studentId } = await joinCollege(c);
    const { last } = await takeCheck(c, studentId, "pre", 1);
    expect((last as { minutes?: number }).minutes).toBeUndefined();
  });
});

describe("comments and round trips", () => {
  it("UG-XXXX codes are refused in comments, in any case, like the other login codes", () => {
    for (const comment of ["my code is UG-K7QM", "ug-k7qm liked it", "UG-K7QM"]) expect(commentProblem(comment), comment).toBe("personal");
    for (const fine of ["UG students will like this", "2x - 1 = 3", "Nice for 1st year UG"]) expect(commentProblem(fine), fine).toBeNull();
  });

  it("a college student's code in a saved comment is refused", async () => {
    const c = await fresh();
    const { studentId, code } = await joinCollege(c);
    await takeCheck(c, studentId, "pre", 1);
    c.clock.advanceMinutes(12);
    await takeCheck(c, studentId, "post", 1);
    expect(await c.svc.saveChallengeFeedback(studentId, { useful: 4, teachHelped: null, comment: `I am ${code}`, quoteOk: true })).toMatchObject({ ok: false, errorKey: "challenge.fb.personal" });
  });

  it("a college student's overview in the practise step takes at most 9 round trips", async () => {
    const c = await fresh();
    const { a, b } = await bothGroups(c);
    for (const id of [a, b]) {
      await takeCheck(c, id, "pre", 3);
      const { n } = await c.trips(() => c.svc.challengeOverview(id));
      expect(n).toBeLessThanOrEqual(9);
    }
  });
});
