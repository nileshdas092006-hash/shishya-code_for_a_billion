import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { READY_CHECK_ID, readyQuestion } from "../../core/readyCheck";
import { setup } from "./helpers";

// P1d. The Ready check: before the first skill a child answers 6 quick whole-number questions, once. 5 or 6 right:
// nothing changes. 4 or fewer: the class board lists the child under "Needs number basics first (outside Shishya)",
// and the child can still practise (we never block a child). Stored as items and attempts with the skill id
// num.ready-check, which is NOT part of the mastery chain: nothing is ever written to the mastery table for it.

let ctx: Awaited<ReturnType<typeof setup>> | undefined;
afterEach(() => {
  ctx?.done();
  ctx = undefined;
});

const FIRST_SKILL = "alg.integers.ops";

/** Takes the whole check, getting `right` of the 6 questions right. */
async function take(c: NonNullable<typeof ctx>, studentId: string, right: number) {
  const check = await c.svc.startReadyCheck(studentId);
  if (!check.ok) throw new Error(check.reason);
  let last;
  for (const [i, item] of check.items.entries()) {
    const answer = (await c.store.getItem(item.itemId))!.answer;
    last = await c.svc.submitReadyCheckAnswer(item.itemId, i < right ? answer : String(Number(answer) + 1));
  }
  return { check, last: last! };
}

describe("the Ready check", () => {
  it("is offered once: 6 questions (2 +, 2 −, 2 ×) from seeds, then never again", async () => {
    ctx = await setup();
    const c = ctx;
    expect(await c.svc.readyCheckStatus(c.student.id)).toMatchObject({ state: "due", correct: null });
    const check = await c.svc.startReadyCheck(c.student.id);
    if (!check.ok) throw new Error(check.reason);
    expect(check.items).toHaveLength(6);
    expect(check.items.map((i) => i.text.split(" ")[1])).toEqual(["+", "+", "−", "−", "×", "×"]);
    const items = await c.store.getItems(check.items.map((i) => i.itemId));
    for (const it of items) {
      expect(it).toMatchObject({ skillId: READY_CHECK_ID, kind: "practice" });
      expect(check.items.find((x) => x.itemId === it.id)!.text).toBe(readyQuestion(it.seed).text);
    }
    expect(await c.svc.readyCheckStatus(c.student.id)).toMatchObject({ state: "running" });
    // asking again while it runs gives the same check back
    const again = await c.svc.startReadyCheck(c.student.id);
    expect(again.ok && again.checkId).toBe(check.checkId);

    for (const it of check.items) await c.svc.submitReadyCheckAnswer(it.itemId, (await c.store.getItem(it.itemId))!.answer);
    expect(await c.svc.readyCheckStatus(c.student.id)).toMatchObject({ state: "done", correct: 6 });
    expect(await c.svc.startReadyCheck(c.student.id)).toMatchObject({ ok: false, code: "finished" });
  });

  it("5 or 6 right: ready; 4 or fewer: needs number basics first", async () => {
    ctx = await setup();
    const c = ctx;
    const codes = ["8B-21", "8B-22", "8B-23"];
    const kids = await Promise.all(codes.map((code) => c.svc.createStudent(c.cls.id, code)));
    expect((await take(c, kids[0].id, 6)).last).toMatchObject({ ok: true, finished: true, correct: 6, total: 6, ready: true });
    expect((await take(c, kids[1].id, 5)).last).toMatchObject({ finished: true, correct: 5, ready: true });
    expect((await take(c, kids[2].id, 4)).last).toMatchObject({ finished: true, correct: 4, ready: false });
    const board = await c.svc.getClassBoard(c.cls.id);
    expect(board.numberBasics).toEqual([{ code: "8B-23", correct: 4, total: 6, seen: false }]);
  });

  it("the board list: only children who took it and got 4 or fewer; a teacher can mark a child seen", async () => {
    ctx = await setup();
    const c = ctx;
    const a = await c.svc.createStudent(c.cls.id, "8B-31");
    const b = await c.svc.createStudent(c.cls.id, "8B-32");
    await take(c, a.id, 0);
    await take(c, b.id, 2);
    // 8B-17 has not taken it: not listed
    expect((await c.svc.getClassBoard(c.cls.id)).numberBasics.map((x) => x.code)).toEqual(["8B-31", "8B-32"]);
    expect(await c.svc.markReadyCheckSeen(c.cls.id, "8B-31")).toBe(true);
    expect((await c.svc.getClassBoard(c.cls.id)).numberBasics).toEqual([
      { code: "8B-31", correct: 0, total: 6, seen: true },
      { code: "8B-32", correct: 2, total: 6, seen: false },
    ]);
    // another class cannot mark this class's child
    const other = await c.svc.createClass("KV8C", 8);
    expect(await c.svc.markReadyCheckSeen(other.id, "8B-32")).toBe(false);
    expect((await c.svc.getClassBoard(c.cls.id)).numberBasics[1].seen).toBe(false);
  });

  it("never blocks a child: practice is open before, during and after a low score", async () => {
    ctx = await setup();
    const c = ctx;
    expect(await c.svc.servePracticeItem(c.student.id, FIRST_SKILL)).toMatchObject({ ok: true });
    await take(c, c.student.id, 1);
    expect(await c.svc.servePracticeItem(c.student.id, FIRST_SKILL)).toMatchObject({ ok: true });
  });

  it("never touches mastery: no mastery row or mastery event for it, and other rows are unchanged", async () => {
    ctx = await setup();
    const c = ctx;
    await c.svc.getSkillMap(c.student.id); // opens the first skill
    const before = await c.store.listMastery({ studentId: c.student.id });
    const eventsBefore = (await c.store.listEvents()).filter((e) => e.type === "mastery_changed").length;
    await take(c, c.student.id, 3);
    expect(await c.store.listMastery({ studentId: c.student.id })).toEqual(before);
    expect(await c.store.getMastery(c.student.id, READY_CHECK_ID)).toBeUndefined();
    expect((await c.store.listEvents()).filter((e) => e.type === "mastery_changed").length).toBe(eventsBefore);
    expect((await c.svc.getSkillMap(c.student.id)).map((s) => s.skillId)).not.toContain(READY_CHECK_ID);
  });

  it("is scored from the seeds, and its answers never reach the board's mistakes or the Miner", async () => {
    ctx = await setup();
    const c = ctx;
    const check = await c.svc.startReadyCheck(c.student.id);
    if (!check.ok) throw new Error(check.reason);
    const db = createClient({ url: c.url });
    try {
      await db.execute({ sql: "UPDATE items SET answer = '1' WHERE id = ?", args: [check.items[0].itemId] });
    } finally {
      db.close();
    }
    let last;
    for (const [i, it] of check.items.entries()) {
      const answer = i === 0 ? "1" : (await c.store.getItem(it.itemId))!.answer;
      last = await c.svc.submitReadyCheckAnswer(it.itemId, answer);
    }
    expect(last).toMatchObject({ finished: true, correct: 5 });
    const board = await c.svc.getStuckBoard(c.cls.id);
    expect(board.groups).toEqual([]);
    expect(board.slips).toEqual([]);
    expect(await c.store.listUnknownErrors(READY_CHECK_ID)).toEqual([]);
    // its items cannot be answered through the practice path
    await expect(c.svc.submitPracticeAnswer(check.items[0].itemId, "1")).rejects.toThrow();
  });
});
