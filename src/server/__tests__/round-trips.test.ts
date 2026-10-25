import { afterEach, describe, expect, it } from "vitest";
import { createServices } from "../services";
import { openStore } from "../store";
import { answerProof, makeClock, SKILL, teachPerfectly, tempDbUrl } from "./helpers";

// On Turso every query is a network round trip, so a page that runs one query per student per skill gets slow
// as the class grows (the live class board took 7–9 s). These limits are FIXED: they must not grow with the
// number of students.

const CLASS_SIZE = 40;
const LIMITS = { classBoard: 8, unlockClass: 8, skillMap: 3, teacherPin: 2, proofFinish: 20 };

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function counted() {
  const { url, cleanup: rm } = tempDbUrl();
  const counter = { n: 0 };
  const store = await openStore({ url, onRoundTrip: () => void counter.n++ });
  const clock = makeClock();
  const svc = createServices(store, { now: clock.now, cooldownHours: 24 });
  cleanup = () => {
    store.close();
    rm();
  };
  /** Round trips used by one call. */
  const trips = async <T>(fn: () => Promise<T>): Promise<{ n: number; out: T }> => {
    counter.n = 0;
    const out = await fn();
    return { n: counter.n, out };
  };
  return { store, svc, clock, trips };
}

async function classOf40(svc: Awaited<ReturnType<typeof counted>>["svc"]) {
  const room = await svc.createClassroom({ grade: 8, section: "Q", studentCount: CLASS_SIZE, pin: "123456" });
  await svc.openProofWindow(room.classId); // a class made now needs the teacher to open proofs
  const ids = [];
  for (const code of room.studentCodes) {
    const r = await svc.studentLogin(room.classCode, code);
    if (!r.ok) throw new Error("login");
    ids.push(r.studentId);
  }
  return { room, ids };
}

describe("database round trips stay small and do not grow with the class", () => {
  it(`unlocking a skill for a class of ${CLASS_SIZE} takes at most ${LIMITS.unlockClass} round trips`, async () => {
    const { svc, trips } = await counted();
    const { room } = await classOf40(svc);
    const { n, out } = await trips(() => svc.teacherUnlockClass(room.classId, SKILL));
    expect(out).toBe(CLASS_SIZE);
    expect(n).toBeLessThanOrEqual(LIMITS.unlockClass);
    // a second unlock opens nothing and writes nothing
    expect((await trips(() => svc.teacherUnlockClass(room.classId, SKILL))).out).toBe(0);
  });

  it(`the class board (stuck board, progress, drafts, codes) for ${CLASS_SIZE} students takes at most ${LIMITS.classBoard}`, async () => {
    const { svc, store, trips } = await counted();
    const { room, ids } = await classOf40(svc);
    await svc.teacherUnlockClass(room.classId, SKILL);
    for (const id of ids.slice(0, 5)) {
      const item = await svc.servePracticeItem(id, SKILL);
      if (item.ok) await svc.submitPracticeAnswer(item.itemId, "1000");
    }
    const { last } = await teachPerfectly(svc, store, ids[0]);
    expect(last.ok && last.state).toBe("KEY1");
    const proof = await svc.startProof(ids[0], SKILL);
    if (!proof.ok) throw new Error(proof.reason);
    await answerProof(svc, store, proof.items.map((i) => i.itemId));

    await svc.getClassBoard(room.classId); // first view may open skills whose prerequisites are mastered
    const { n, out } = await trips(() => svc.getClassBoard(room.classId));
    expect(n).toBeLessThanOrEqual(LIMITS.classBoard);
    expect(out.codes).toHaveLength(CLASS_SIZE);
    const row = out.progress.find((p) => p.skillId === SKILL)!;
    expect(row.counts).toMatchObject({ LOCKED: 0, OPEN: CLASS_SIZE - 1, MASTERED: 1 });
    expect(out.stuck.groups.reduce((s, g) => s + g.count, 0) + out.stuck.slips.flatMap((x) => x.students).length).toBe(5);
    // the same answers as the separate calls the page used before
    expect(out.progress).toEqual(await svc.getClassProgress(room.classId));
    expect(out.stuck).toEqual(await svc.getStuckBoard(room.classId));
  });

  it(`a child's skill map takes at most ${LIMITS.skillMap}; a teacher PIN check at most ${LIMITS.teacherPin}`, async () => {
    const { svc, trips } = await counted();
    const { room, ids } = await classOf40(svc);
    const first = await trips(() => svc.getSkillMap(ids[0])); // opens the first skill (it needs nothing)
    expect(first.out[0].state).toBe("OPEN");
    expect(first.n).toBeLessThanOrEqual(LIMITS.skillMap);
    expect((await trips(() => svc.getSkillMap(ids[0]))).n).toBeLessThanOrEqual(LIMITS.skillMap - 1);
    const pin = await trips(() => svc.verifyTeacherPin(room.classCode, "123456"));
    expect(pin.out.ok).toBe(true);
    expect(pin.n).toBeLessThanOrEqual(LIMITS.teacherPin);
  });

  it(`the answer that finishes a proof (check, mastery, what to practise, unlocks) takes at most ${LIMITS.proofFinish}`, async () => {
    const { svc, store, trips } = await counted();
    const { room, ids } = await classOf40(svc);
    await svc.teacherUnlockClass(room.classId, SKILL);
    await teachPerfectly(svc, store, ids[0]);
    const proof = await svc.startProof(ids[0], SKILL);
    if (!proof.ok) throw new Error(proof.reason);
    const itemIds = proof.items.map((i) => i.itemId);
    await answerProof(svc, store, itemIds.slice(0, -1));
    const lastAnswer = (await store.getItem(itemIds.at(-1)!))!.answer;
    const { n, out } = await trips(() => svc.submitProofAnswer(itemIds.at(-1)!, lastAnswer));
    expect(out).toMatchObject({ ok: true, finished: true, passed: true, state: "MASTERED" });
    expect(n).toBeLessThanOrEqual(LIMITS.proofFinish);
  });
});
