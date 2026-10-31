import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { CHECK_PLANS } from "../../core/challengeCheck";
import { createServices, type ServiceOptions } from "../services";
import { openStore } from "../store";
import { correctFix, makeClock, SKILL, teachPerfectly, tempDbUrl } from "./helpers";

// F11 Part 2. The guided challenge at /s/challenge: 1 Before · 2 Practise · 3 After · 4 Feedback, then Done, and
// an optional 4-question check 3 to 21 days later. Group A practises 8 questions on "x on both sides"; group B
// practises 4 and then teaches the Shishya once (3 traces). Anyone may go on after 12 minutes of the practise step.
// The checks are single-use questions scored again from their seeds; they never change mastery and are never a
// proof run.

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
  // random() < 0.5: the class starts with group A, so in each class level the 1st student is A and the 2nd is B
  const svc = createServices(store, { cooldownHours: 24, random: () => 0.1, ...opts, now: clock.now });
  cleanup = () => {
    store.close();
    rm();
  };
  const ch = await svc.createChallenge({ title: "Udgam Shishya Challenge", trial: false, online: true, pin: "123456" });
  const trips = async <T>(fn: () => Promise<T>): Promise<{ n: number; out: T }> => {
    counter.n = 0;
    const out = await fn();
    return { n: counter.n, out };
  };
  return { store, svc, clock, ch, url, trips };
}

type Ctx = Awaited<ReturnType<typeof fresh>>;

async function join(c: Ctx, grade = 8) {
  const r = await c.svc.joinChallenge(c.ch.joinToken, grade);
  if (!r.ok) throw new Error(r.reason);
  return r.studentId;
}

/** A student of group A and one of group B in the same class level. */
async function bothGroups(c: Ctx) {
  const a = await join(c, 8);
  const b = await join(c, 8);
  expect((await c.store.getChallengeStudent(a))?.studyArm).toBe("A");
  expect((await c.store.getChallengeStudent(b))?.studyArm).toBe("B");
  return { a, b };
}

/** Takes a whole check, answering the first `right` questions right and the rest wrong. */
async function takeCheck(c: Ctx, studentId: string, phase: "pre" | "post" | "delayed", right: number) {
  const check = await c.svc.startChallengeCheck(studentId, phase);
  if (!check.ok) throw new Error(`${phase}: ${check.reason}`);
  const outs = [];
  for (const [i, item] of check.items.entries()) {
    const answer = (await c.store.getItem(item.itemId))!.answer;
    outs.push(await c.svc.submitChallengeCheckAnswer(item.itemId, i < right ? answer : `${answer}1`));
  }
  return { check, outs, last: outs.at(-1)! };
}

async function practise(c: Ctx, studentId: string, n: number) {
  for (let i = 0; i < n; i++) {
    const item = await c.svc.servePracticeItem(studentId, SKILL);
    if (!item.ok) throw new Error(item.reason);
    await c.svc.submitPracticeAnswer(item.itemId, (await c.store.getItem(item.itemId))!.answer);
  }
}

const step = async (c: Ctx, studentId: string) => {
  const o = await c.svc.challengeOverview(studentId);
  if (!o.ok) throw new Error(o.reason);
  return o;
};

describe("the whole challenge, group A (practise only)", () => {
  it("before (no receipts until the end) → 8 practise questions → after (new questions) → feedback → done", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    expect(await step(c, a)).toMatchObject({ step: "welcome", teach: false, scores: { pre: null, post: null, total: 6 } });

    const pre = await takeCheck(c, a, "pre", 3);
    expect(pre.check.items).toHaveLength(6);
    const preItems = await c.store.getItems(pre.check.items.map((i) => i.itemId));
    expect(pre.check.items.map((i) => preItems.find((x) => x.id === i.itemId)!.skillId)).toEqual(CHECK_PLANS.pre);
    // no hints and no receipts while it runs: exactly "saved"
    for (const out of pre.outs.slice(0, -1)) expect(out).toEqual({ ok: true, finished: false });
    expect(pre.last).toMatchObject({ ok: true, finished: true, phase: "pre", score: 3, total: 6 });
    if (!pre.last.ok || !pre.last.finished) throw new Error("not finished");
    expect(pre.last.receipts).toHaveLength(6);
    expect(pre.last.receipts.every((r) => r.receipt !== null)).toBe(true);

    const p = await step(c, a);
    expect(p).toMatchObject({ step: "practise", teach: false, practise: { target: 8, done: 0, ready: false } });
    expect(await c.svc.startChallengeCheck(a, "post")).toMatchObject({ ok: false, code: "not_ready" });
    await practise(c, a, 7);
    expect(await step(c, a)).toMatchObject({ practise: { done: 7, ready: false } });
    await practise(c, a, 1);
    expect(await step(c, a)).toMatchObject({ step: "practise", practise: { done: 8, ready: true } });

    const post = await takeCheck(c, a, "post", 5);
    expect(post.last).toMatchObject({ ok: true, finished: true, phase: "post", score: 5, total: 6, before: 3 });
    expect(await step(c, a)).toMatchObject({ step: "feedback", scores: { pre: 3, post: 5 } });

    expect(await c.svc.saveChallengeFeedback(a, { useful: 4, teachHelped: 5, comment: "", quoteOk: null })).toEqual({ ok: true });
    const fb = await c.store.getStudentFeedback(a);
    expect(fb).toMatchObject({ useful: 4, teachHelped: null, comment: null, quoteOk: false, approved: null });
    expect(await step(c, a)).toMatchObject({ step: "done", scores: { pre: 3, post: 5, delayed: null }, delayed: { state: "later" } });
  });

  it("the practise step counts only answers given after the before check", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    await practise(c, a, 8); // before the challenge started: not part of it
    await takeCheck(c, a, "pre", 6);
    expect(await step(c, a)).toMatchObject({ practise: { done: 0, ready: false } });
  });
});

describe("group B (practise + teach the Shishya)", () => {
  it("4 practise questions, then one teach session; KEY1 only through the normal teach rule", async () => {
    const c = await fresh();
    const { b } = await bothGroups(c);
    expect(await step(c, b)).toMatchObject({ teach: true });
    await takeCheck(c, b, "pre", 6); // all right: a check never gives KEY1 or anything else
    expect(await c.svc.getState(b, SKILL)).toBe("OPEN");
    expect(await step(c, b)).toMatchObject({ step: "practise", teach: true, practise: { target: 4, done: 0, teachDone: false, ready: false } });
    await practise(c, b, 4);
    expect(await step(c, b)).toMatchObject({ practise: { done: 4, teachDone: false, ready: false } });
    expect(await c.svc.startChallengeCheck(b, "post")).toMatchObject({ ok: false, code: "not_ready" });

    const { session, last } = await teachPerfectly(c.svc, c.store, b);
    expect(last).toMatchObject({ ok: true, state: "KEY1" });
    const evidence = JSON.parse((await c.store.getMastery(b, SKILL))!.evidenceJson);
    expect(evidence.key1.sessionId).toBe(session.sessionId);
    expect(evidence.unlock).toEqual({ by: "challenge" });
    expect(await step(c, b)).toMatchObject({ practise: { teachDone: true, ready: true } });

    await takeCheck(c, b, "post", 6);
    expect(await c.svc.saveChallengeFeedback(b, { useful: 5, teachHelped: 4, comment: "Teaching the Shishya was fun", quoteOk: true })).toEqual({ ok: true });
    expect(await c.store.getStudentFeedback(b)).toMatchObject({ useful: 5, teachHelped: 4, comment: "Teaching the Shishya was fun", quoteOk: true, approved: null });
  });

  it("a teach session counts as done when every trace is fixed or out of tries (the teach rule may not be met)", async () => {
    const c = await fresh();
    const { b } = await bothGroups(c);
    await takeCheck(c, b, "pre", 2);
    await practise(c, b, 4);
    const session = await c.svc.startTeach(b, SKILL);
    if (!session.ok) throw new Error(session.reason);
    const [first, ...rest] = session.traces;
    const wrong = await correctFix(c.store, first.itemId);
    await c.svc.submitTeachStep(first.itemId, wrong.line, wrong.wrongText);
    expect(await step(c, b)).toMatchObject({ practise: { teachStarted: true, teachDone: false } });
    await c.svc.submitTeachStep(first.itemId, wrong.line, wrong.wrongText); // second try used: no tries left
    for (const t of rest) {
      const fix = await correctFix(c.store, t.itemId);
      await c.svc.submitTeachStep(t.itemId, fix.line, fix.text);
    }
    expect(await c.svc.getState(b, SKILL)).toBe("OPEN");
    expect(await step(c, b)).toMatchObject({ practise: { teachDone: true, ready: true } });
    expect(await c.svc.startChallengeCheck(b, "post")).toMatchObject({ ok: true });
  });

  it("group B must say whether teaching helped; group A is never asked (and its answer is not kept)", async () => {
    const c = await fresh();
    const { a, b } = await bothGroups(c);
    for (const id of [a, b]) {
      await takeCheck(c, id, "pre", 1);
      c.clock.advanceMinutes(12);
      await takeCheck(c, id, "post", 2);
    }
    expect(await c.svc.saveChallengeFeedback(b, { useful: 3, teachHelped: null, comment: "", quoteOk: null })).toMatchObject({ ok: false, errorKey: "challenge.fb.teachNeeded" });
    expect(await c.svc.saveChallengeFeedback(b, { useful: 3, teachHelped: 6, comment: "", quoteOk: null })).toMatchObject({ ok: false, errorKey: "challenge.fb.teachNeeded" });
    expect(await c.svc.saveChallengeFeedback(b, { useful: 3, teachHelped: 2, comment: "", quoteOk: null })).toEqual({ ok: true });
    expect(await c.svc.saveChallengeFeedback(a, { useful: 3, teachHelped: 2, comment: "", quoteOk: null })).toEqual({ ok: true });
    expect((await c.store.getStudentFeedback(a))?.teachHelped).toBeNull();
  });
});

describe("the practise step", () => {
  it("anyone may go on to the after check after 12 minutes in it, without finishing the set", async () => {
    const c = await fresh();
    const { a, b } = await bothGroups(c);
    for (const id of [a, b]) await takeCheck(c, id, "pre", 2);
    c.clock.advanceMinutes(11);
    expect(await step(c, a)).toMatchObject({ practise: { ready: false, skipInSeconds: 60 } });
    expect(await c.svc.startChallengeCheck(a, "post")).toMatchObject({ ok: false, code: "not_ready" });
    c.clock.advanceMinutes(1);
    expect(await step(c, a)).toMatchObject({ practise: { ready: true, skipInSeconds: 0 } });
    expect(await c.svc.startChallengeCheck(a, "post")).toMatchObject({ ok: true });
    expect(await c.svc.startChallengeCheck(b, "post")).toMatchObject({ ok: true });
  });

  it("the after check needs the before check first, and each check is taken once", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    expect(await c.svc.startChallengeCheck(a, "post")).toMatchObject({ ok: false, code: "not_ready" });
    const first = await c.svc.startChallengeCheck(a, "pre");
    const again = await c.svc.startChallengeCheck(a, "pre"); // while it runs: the same check back
    expect(first.ok && again.ok && again.checkId === first.checkId).toBe(true);
    expect(await step(c, a)).toMatchObject({ step: "pre" });
    if (!first.ok) throw new Error("no check");
    for (const it of first.items) await c.svc.submitChallengeCheckAnswer(it.itemId, "1");
    expect(await c.svc.startChallengeCheck(a, "pre")).toMatchObject({ ok: false, code: "finished" });
    expect(await c.svc.submitChallengeCheckAnswer(first.items[0].itemId, "2")).toMatchObject({ ok: false, code: "finished" });
  });
});

describe("the checks", () => {
  it("never write mastery and are never a proof run", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    const masteryBefore = await c.store.listMastery({ studentId: a });
    const changesBefore = (await c.store.listEvents()).filter((e) => e.type === "mastery_changed").length;
    await takeCheck(c, a, "pre", 6);
    c.clock.advanceMinutes(12);
    await takeCheck(c, a, "post", 6);
    await c.svc.saveChallengeFeedback(a, { useful: 5, teachHelped: null, comment: "", quoteOk: null });
    c.clock.advanceHours(72);
    await takeCheck(c, a, "delayed", 4);
    expect(await c.store.listMastery({ studentId: a })).toEqual(masteryBefore);
    expect((await c.store.listEvents()).filter((e) => e.type === "mastery_changed").length).toBe(changesBefore);
    expect(await c.svc.proofStatus(a, SKILL)).toMatchObject({ canStart: false, code: "not_ready" });
    const db = createClient({ url: c.url });
    try {
      expect(Number((await db.execute("SELECT COUNT(*) AS n FROM proofRuns")).rows[0].n)).toBe(0);
      const kinds = (await db.execute("SELECT DISTINCT kind, source FROM items WHERE runId IN (SELECT id FROM checks)")).rows.map((r) => `${r.kind}/${r.source}`);
      expect(kinds.sort()).toEqual(["proof/delayed", "proof/post", "proof/pre"]);
    } finally {
      db.close();
    }
  });

  it("cannot be answered through the practice, proof or quick-check paths", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    const check = await c.svc.startChallengeCheck(a, "pre");
    if (!check.ok) throw new Error(check.reason);
    const id = check.items[4].itemId;
    await expect(c.svc.submitPracticeAnswer(id, "1")).rejects.toThrow();
    expect(await c.svc.submitProofAnswer(id, "1")).toMatchObject({ ok: false, code: "finished" });
    await expect(c.svc.submitRecheckAnswer(id, "1")).rejects.toThrow();
    expect((await c.store.getItem(id))?.answeredAt).toBeNull();
  });

  it("before and after never share a question; the after check has new numbers (not even a practised question)", async () => {
    const c = await fresh();
    const { a, b } = await bothGroups(c);
    for (const id of [a, b]) {
      const pre = await takeCheck(c, id, "pre", 1);
      await practise(c, id, 8);
      c.clock.advanceMinutes(12); // group B has not taught: it goes on after 12 minutes
      const post = await takeCheck(c, id, "post", 1);
      const seen = await c.store.getItems([...pre.check.items, ...post.check.items].map((i) => i.itemId));
      const key = (x: { skillId: string; paramsJson: string }) => `${x.skillId}|${x.paramsJson}`;
      const preKeys = seen.filter((x) => x.source === "pre").map(key);
      const postKeys = seen.filter((x) => x.source === "post").map(key);
      expect(preKeys).toHaveLength(6);
      expect(postKeys).toHaveLength(6);
      expect(postKeys.filter((k) => preKeys.includes(k))).toEqual([]);
      const practised = (await c.store.listItems({ studentId: id, skillId: SKILL, kind: "practice" })).map(key);
      expect(postKeys.filter((k) => practised.includes(k))).toEqual([]);
      expect(new Set(seen.map((x) => x.seed)).size).toBe(12);
    }
  });

  it("are scored again from the seeds: a changed stored answer changes nothing", async () => {
    const c = await fresh();
    const { a } = await bothGroups(c);
    const check = await c.svc.startChallengeCheck(a, "pre");
    if (!check.ok) throw new Error(check.reason);
    const answers = [];
    for (const it of check.items) answers.push((await c.store.getItem(it.itemId))!.answer);
    const db = createClient({ url: c.url });
    try {
      await db.execute({ sql: "UPDATE items SET answer = '999' WHERE id = ?", args: [check.items[0].itemId] });
    } finally {
      db.close();
    }
    let last;
    for (const [i, it] of check.items.entries()) last = await c.svc.submitChallengeCheckAnswer(it.itemId, answers[i]);
    expect(last).toMatchObject({ finished: true, score: 6 });
    expect(await step(c, a)).toMatchObject({ scores: { pre: 6 } });
  });
});

describe("feedback", () => {
  async function ready(c: Ctx) {
    const { a } = await bothGroups(c);
    await takeCheck(c, a, "pre", 2);
    c.clock.advanceMinutes(12);
    return a;
  }
  const fb = (extra: Partial<{ useful: number | null; comment: string; quoteOk: boolean | null }>) => ({
    useful: 4 as number | null,
    teachHelped: null,
    comment: "",
    quoteOk: null as boolean | null,
    ...extra,
  });

  it("comes after the after check, once", async () => {
    const c = await fresh();
    const a = await ready(c);
    expect(await c.svc.saveChallengeFeedback(a, fb({}))).toMatchObject({ ok: false, code: "not_ready" });
    await takeCheck(c, a, "post", 3);
    expect(await c.svc.saveChallengeFeedback(a, fb({}))).toEqual({ ok: true });
    expect(await c.svc.saveChallengeFeedback(a, fb({ useful: 1 }))).toMatchObject({ ok: false, code: "finished" });
    expect((await c.store.getStudentFeedback(a))?.useful).toBe(4);
  });

  it("'How useful was this?' is required, 1 to 5", async () => {
    const c = await fresh();
    const a = await ready(c);
    await takeCheck(c, a, "post", 3);
    for (const useful of [null, 0, 6, 2.5]) {
      expect(await c.svc.saveChallengeFeedback(a, fb({ useful })), String(useful)).toMatchObject({ ok: false, errorKey: "challenge.fb.usefulNeeded" });
    }
  });

  it("refuses a comment with an email address, a link, a phone-like number or a handle, or over 200 characters", async () => {
    const c = await fresh();
    const a = await ready(c);
    await takeCheck(c, a, "post", 3);
    const personal = [
      "mail me at riya.s@gmail.com",
      "see https://example.com",
      "www.mysite.in is mine",
      "my site is riya.com",
      "call 9876543210",
      "call 98765 43210",
      "phone ९८७६५४३२१०",
      "insta @riya_123",
      "pin 781039",
    ];
    for (const comment of personal) {
      expect(await c.svc.saveChallengeFeedback(a, fb({ comment, quoteOk: false })), comment).toMatchObject({ ok: false, errorKey: "challenge.fb.personal" });
    }
    expect(await c.svc.saveChallengeFeedback(a, fb({ comment: "a".repeat(201), quoteOk: false }))).toMatchObject({ ok: false, errorKey: "challenge.fb.tooLong" });
    expect(await c.svc.saveChallengeFeedback(a, fb({ comment: "It was good" }))).toMatchObject({ ok: false, errorKey: "challenge.fb.quoteNeeded" });
    expect(await c.store.getStudentFeedback(a)).toBeUndefined();
    // maths is fine: 2x + 3 = 11 and x = 4 have no long number
    expect(await c.svc.saveChallengeFeedback(a, fb({ comment: "  2x + 3 = 11 so x = 4. Liked the keypad!  ", quoteOk: true }))).toEqual({ ok: true });
    expect(await c.store.getStudentFeedback(a)).toMatchObject({ comment: "2x + 3 = 11 so x = 4. Liked the keypad!", quoteOk: true, approved: null });
  });
});

describe("the later (delayed) check", () => {
  async function finished(c: Ctx) {
    const { a } = await bothGroups(c);
    await takeCheck(c, a, "pre", 2);
    c.clock.advanceMinutes(12);
    await takeCheck(c, a, "post", 4);
    await c.svc.saveChallengeFeedback(a, fb());
    return a;
  }
  const fb = () => ({ useful: 4, teachHelped: null, comment: "", quoteOk: null });

  it("is offered from 3 to 21 days after the after check: 4 new questions (1 one-step, 1 two-step, 2 both sides), once", async () => {
    const c = await fresh();
    const a = await finished(c);
    c.clock.advanceHours(71);
    expect(await step(c, a)).toMatchObject({ step: "done", delayed: { state: "later" } });
    expect(await c.svc.startChallengeCheck(a, "delayed")).toMatchObject({ ok: false, code: "not_due" });
    c.clock.advanceHours(1);
    expect(await step(c, a)).toMatchObject({ step: "done", delayed: { state: "due" } });
    const d = await takeCheck(c, a, "delayed", 3);
    const items = await c.store.getItems(d.check.items.map((i) => i.itemId));
    expect(d.check.items.map((i) => items.find((x) => x.id === i.itemId)!.skillId)).toEqual(CHECK_PLANS.delayed);
    expect(d.last).toMatchObject({ finished: true, phase: "delayed", score: 3, total: 4 });
    expect(await step(c, a)).toMatchObject({ step: "done", scores: { pre: 2, post: 4, delayed: 3, delayedTotal: 4 }, delayed: { state: "done" } });
    expect(await c.svc.startChallengeCheck(a, "delayed")).toMatchObject({ ok: false, code: "finished" });
  });

  it("is not offered after 21 days", async () => {
    const c = await fresh();
    const a = await finished(c);
    c.clock.advanceHours(21 * 24 + 1);
    expect(await step(c, a)).toMatchObject({ step: "done", delayed: { state: "missed" } });
    expect(await c.svc.startChallengeCheck(a, "delayed")).toMatchObject({ ok: false, code: "not_due" });
  });
});

describe("only for challenge students", () => {
  it("a classroom student has no challenge", async () => {
    const c = await fresh();
    const room = await c.svc.createClassroom({ grade: 8, section: "B", studentCount: 1, pin: "123456" });
    await c.svc.recordConsent(room.classId, { allowed: true, slips: 1 });
    const login = await c.svc.studentLogin(room.classCode, room.studentCodes[0]);
    if (!login.ok) throw new Error(login.reason);
    expect(await c.svc.challengeOverview(login.studentId)).toMatchObject({ ok: false, code: "none" });
    expect(await c.svc.startChallengeCheck(login.studentId, "pre")).toMatchObject({ ok: false, code: "none" });
  });

  it("the overview takes at most 8 round trips", async () => {
    const c = await fresh();
    const { b } = await bothGroups(c);
    await takeCheck(c, b, "pre", 2);
    await practise(c, b, 4);
    await teachPerfectly(c.svc, c.store, b);
    const { n, out } = await c.trips(() => c.svc.challengeOverview(b));
    expect(out).toMatchObject({ ok: true, step: "practise" });
    expect(n).toBeLessThanOrEqual(8);
  });
});

describe("deleting a challenge class", () => {
  it("removes its checks and feedback with everything else; no row mentions it or its students", async () => {
    const c = await fresh();
    const { a, b } = await bothGroups(c);
    for (const id of [a, b]) {
      await takeCheck(c, id, "pre", 2);
      c.clock.advanceMinutes(12);
      await takeCheck(c, id, "post", 3);
    }
    await c.svc.saveChallengeFeedback(a, { useful: 4, teachHelped: null, comment: "nice", quoteOk: true });
    const done = await c.svc.deleteClass(c.ch.classId, c.ch.classCode);
    expect(done).toMatchObject({ ok: true, counts: { students: 2, checks: 4, feedback: 1 } });
    const db = createClient({ url: c.url });
    try {
      const tables = (await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).rows.map((r) => String(r.name));
      for (const t of tables) {
        for (const row of (await db.execute(`SELECT * FROM ${t}`)).rows) {
          const text = JSON.stringify(row);
          expect([c.ch.classId, a, b].some((id) => text.includes(id)), `${t}: ${text}`).toBe(false);
        }
      }
    } finally {
      db.close();
    }
  });
});
