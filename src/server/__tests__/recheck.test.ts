import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import * as mastery from "../mastery";
import { defaultRegistry } from "../skills";
import { answerProof, setup, SKILL, teachPerfectly } from "./helpers";

// P1b. The 7-day re-check: "Mastered" means it stayed. 7 or more days after a skill becomes MASTERED, the child's
// skill map offers "Quick check: 2 questions" (fresh, no hints, 15 minutes). The result is evidence on the mastery
// row, written only by src/server/mastery.ts and re-verified from the seeds. Passing or failing, the state stays
// MASTERED: a failed check marks "needs another look" for the teacher and asks the child to practise again.

let ctx: Awaited<ReturnType<typeof setup>> | undefined;
afterEach(() => {
  ctx?.done();
  ctx = undefined;
});

const DAY_MINUTES = 24 * 60;

async function masteredChild() {
  ctx = await setup({ cooldownHours: 0 });
  const { svc, store, student } = ctx;
  await svc.teacherUnlock(student.id, SKILL);
  await teachPerfectly(svc, store, student.id);
  const proof = await svc.startProof(student.id, SKILL);
  if (!proof.ok) throw new Error(proof.reason);
  expect(await answerProof(svc, store, proof.items.map((i) => i.itemId))).toMatchObject({ finished: true, state: "MASTERED" });
  return ctx;
}

const recheckOf = (skills: { skillId: string; recheck: unknown }[]) => skills.find((s) => s.skillId === SKILL)!.recheck;

async function startAndAnswer(c: NonNullable<typeof ctx>, wrongIndex = -1) {
  const run = await c.svc.startRecheck(c.student.id, SKILL);
  if (!run.ok) throw new Error(run.reason);
  let last;
  for (const [i, item] of run.items.entries()) {
    const answer = (await c.store.getItem(item.itemId))!.answer;
    last = await c.svc.submitRecheckAnswer(item.itemId, i === wrongIndex ? `${answer}01` : answer);
  }
  return { run, last: last! };
}

const evidence = async (c: NonNullable<typeof ctx>) => {
  const row = (await c.store.getMastery(c.student.id, SKILL))!;
  return { state: row.state, evidence: JSON.parse(row.evidenceJson) };
};

describe("the 7-day re-check", () => {
  it("is not offered before 7 days after mastery, and is offered from then on", async () => {
    const c = await masteredChild();
    expect(recheckOf(await c.svc.getSkillMap(c.student.id))).toBeNull();
    expect(await c.svc.startRecheck(c.student.id, SKILL)).toMatchObject({ ok: false, code: "not_due" });
    c.clock.advanceMinutes(7 * DAY_MINUTES - 1);
    expect(recheckOf(await c.svc.getSkillMap(c.student.id))).toBeNull();
    expect(await c.svc.startRecheck(c.student.id, SKILL)).toMatchObject({ ok: false, code: "not_due" });
    c.clock.advanceMinutes(2);
    expect(recheckOf(await c.svc.getSkillMap(c.student.id))).toBe("due");

    const run = await c.svc.startRecheck(c.student.id, SKILL);
    if (!run.ok) throw new Error(run.reason);
    expect(run.items).toHaveLength(mastery.RECHECK_QUESTIONS);
    expect(mastery.RECHECK_QUESTIONS).toBe(2);
    expect(Date.parse(run.deadline) - c.clock.t).toBe(15 * 60_000);
    // fresh questions: none of them was on the child's proof or practice
    const items = await c.store.listItems({ studentId: c.student.id, skillId: SKILL });
    const recheckItems = items.filter((i) => i.source === "recheck");
    expect(recheckItems).toHaveLength(2);
    const others = new Set(items.filter((i) => i.source !== "recheck").map((i) => i.paramsJson));
    for (const r of recheckItems) expect(others.has(r.paramsJson)).toBe(false);
    // no hints: only the question text
    expect(Object.keys(run.items[0]).sort()).toEqual(["answered", "itemId", "text"]);
    // asking again while it runs gives the same check back
    const again = await c.svc.startRecheck(c.student.id, SKILL);
    expect(again.ok && again.runId).toBe(run.runId);
  });

  it("passing keeps MASTERED and writes { passed, at, itemIds } evidence; it is not offered again", async () => {
    const c = await masteredChild();
    c.clock.advanceMinutes(7 * DAY_MINUTES);
    const { run, last } = await startAndAnswer(c);
    expect(last).toMatchObject({ ok: true, finished: true, passed: true });
    const { state, evidence: ev } = await evidence(c);
    expect(state).toBe("MASTERED");
    expect(ev.recheck).toMatchObject({ passed: true, at: new Date(c.clock.t).toISOString(), itemIds: run.items.map((i) => i.itemId) });
    expect(ev.proof).toBeDefined(); // the proof evidence is kept
    expect(recheckOf(await c.svc.getSkillMap(c.student.id))).toBe("passed");
    c.clock.advanceMinutes(30 * DAY_MINUTES);
    expect(recheckOf(await c.svc.getSkillMap(c.student.id))).toBe("passed");
    expect(await c.svc.startRecheck(c.student.id, SKILL)).toMatchObject({ ok: false, code: "not_due" });
    const events = (await c.store.listEvents()).filter((e) => e.type === "recheck_recorded");
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0].payloadJson)).toMatchObject({ skillId: SKILL, passed: true });
  });

  it("failing keeps MASTERED, marks it for another look, and is offered again 7 days later", async () => {
    const c = await masteredChild();
    c.clock.advanceMinutes(7 * DAY_MINUTES);
    const { last } = await startAndAnswer(c, 1);
    expect(last).toMatchObject({ ok: true, finished: true, passed: false });
    const { state, evidence: ev } = await evidence(c);
    expect(state).toBe("MASTERED");
    expect(ev.recheck).toMatchObject({ passed: false });
    expect(recheckOf(await c.svc.getSkillMap(c.student.id))).toBe("again");
    // practice stays open for the skill
    expect(await c.svc.servePracticeItem(c.student.id, SKILL)).toMatchObject({ ok: true });

    const board = await c.svc.getClassBoard(c.cls.id);
    const row = board.progress.find((p) => p.skillId === SKILL)!;
    expect(row).toMatchObject({ checkedAgain: 0, needsLook: ["8B-17"] });
    expect(row.counts.MASTERED).toBe(1);

    c.clock.advanceMinutes(7 * DAY_MINUTES);
    expect(recheckOf(await c.svc.getSkillMap(c.student.id))).toBe("due");
    const second = await startAndAnswer(c);
    expect(second.last).toMatchObject({ finished: true, passed: true });
    const after = (await c.svc.getClassBoard(c.cls.id)).progress.find((p) => p.skillId === SKILL)!;
    expect(after).toMatchObject({ checkedAgain: 1, needsLook: [] });
  });

  it("is re-verified from the seeds: a stored 'correct answer' that was changed does not count", async () => {
    const c = await masteredChild();
    c.clock.advanceMinutes(7 * DAY_MINUTES);
    const run = await c.svc.startRecheck(c.student.id, SKILL);
    if (!run.ok) throw new Error(run.reason);
    const db = createClient({ url: c.url });
    try {
      await db.execute({ sql: "UPDATE items SET answer = '12345' WHERE id = ?", args: [run.items[1].itemId] });
    } finally {
      db.close();
    }
    await c.svc.submitRecheckAnswer(run.items[0].itemId, (await c.store.getItem(run.items[0].itemId))!.answer);
    const out = await c.svc.submitRecheckAnswer(run.items[1].itemId, "12345");
    expect(out).toMatchObject({ finished: true, passed: false });
    expect((await evidence(c)).evidence.recheck).toMatchObject({ passed: false });
  });

  it("answers after 15 minutes do not count, and the state stays MASTERED", async () => {
    const c = await masteredChild();
    c.clock.advanceMinutes(7 * DAY_MINUTES);
    const run = await c.svc.startRecheck(c.student.id, SKILL);
    if (!run.ok) throw new Error(run.reason);
    c.clock.advanceMinutes(16);
    const out = await c.svc.submitRecheckAnswer(run.items[0].itemId, (await c.store.getItem(run.items[0].itemId))!.answer);
    expect(out).toMatchObject({ ok: true, finished: true, passed: false });
    expect(await evidence(c)).toMatchObject({ state: "MASTERED", evidence: { recheck: { passed: false } } });
  });

  it("a check item cannot be answered through the practice or proof paths", async () => {
    const c = await masteredChild();
    c.clock.advanceMinutes(7 * DAY_MINUTES);
    const run = await c.svc.startRecheck(c.student.id, SKILL);
    if (!run.ok) throw new Error(run.reason);
    const id = run.items[0].itemId;
    await expect(c.svc.submitPracticeAnswer(id, "1")).rejects.toThrow();
    expect(await c.svc.submitProofAnswer(id, "1")).toMatchObject({ ok: false });
    expect(await c.store.listAttemptsForItem(id)).toEqual([]);
  });

  it("mastery.recordRecheck writes nothing for a skill that is not MASTERED or a check that is not finished", async () => {
    const c = await masteredChild();
    c.clock.advanceMinutes(7 * DAY_MINUTES);
    const run = await c.svc.startRecheck(c.student.id, SKILL);
    if (!run.ok) throw new Error(run.reason);
    const entry = defaultRegistry[SKILL];
    await expect(mastery.recordRecheck(c.store, c.student.id, entry, run.runId, c.clock.now())).rejects.toThrow(/not finished/);
    const other = await c.svc.createStudent(c.cls.id, "8B-18");
    await expect(mastery.recordRecheck(c.store, other.id, entry, run.runId, c.clock.now())).rejects.toThrow(/not found/);
    expect((await evidence(c)).evidence.recheck).toBeUndefined();
  });
});
