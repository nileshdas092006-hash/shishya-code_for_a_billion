import { afterEach, describe, expect, it } from "vitest";
import { createServices } from "../services";
import { openStore } from "../store";
import { TOUR_SKILL } from "../tour";
import { answerProof, makeClock, SKILL, teachPerfectly, tempDbUrl } from "./helpers";

// On Turso every query is a network round trip, so a page that runs one query per student per skill gets slow
// as the class grows (the live class board took 7–9 s). These limits are FIXED: they must not grow with the
// number of students.

const CLASS_SIZE = 40;
const LIMITS = {
  classBoard: 8,
  unlockClass: 8,
  skillMap: 3,
  teacherPin: 2,
  proofFinish: 20,
  tourStart: 5,
  /** "Skip ahead" when the judge has a teach session (stop 2 starts one), and when a new one must be started. */
  tourSkip: 12,
  tourSkipNewSession: 24,
  cleanUp: 4,
  health: 2,
  studentLogin: 2,
  paperSave: 6,
};

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
  await svc.recordConsent(room.classId, { allowed: true, slips: CLASS_SIZE }); // children log in only after this
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

    // a Miner draft waiting for review: its evidence (the explained wrong answers) is one more read, however many
    for (const id of ["d1", "d2"]) {
      await store.insertMinedMistake({
        id,
        skillId: SKILL,
        source: JSON.stringify({ id, label: "l", childLabel: "c", stepType: "divide", firstWrongLine: 5, lines: { "5": "x = {(d - b) / a}" }, answerFormula: "(d - b) / a" }),
        testsJson: JSON.stringify({ reproduced: 3, checkedInstances: 1000, overlaps: {} }),
        status: "DRAFT_TESTED",
        approver: null,
        createdAt: "2026-10-20T09:00:00.000Z",
      });
    }

    await svc.getClassBoard(room.classId); // first view may open skills whose prerequisites are mastered
    const { n, out } = await trips(() => svc.getClassBoard(room.classId));
    expect(out.mined.map((m) => m.checks.length)).toEqual([4, 4]);
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

  it(`starting a Judge Tour (31 children and their whole history) takes at most ${LIMITS.tourStart}, with or without the clean-up`, async () => {
    const { svc, trips, clock } = await counted();
    const first = await trips(() => svc.startTour()); // the hourly clean-up runs here (nothing has expired yet)
    expect(first.out.ok).toBe(true);
    expect(first.n).toBeLessThanOrEqual(LIMITS.tourStart);
    clock.advanceMinutes(5);
    const second = await trips(() => svc.startTour()); // no clean-up within the hour
    expect(second.out.ok).toBe(true);
    expect(second.n).toBeLessThanOrEqual(LIMITS.tourStart - 1);
  });

  it(`"Skip ahead" in a tour takes at most ${LIMITS.tourSkip} (${LIMITS.tourSkipNewSession} if it starts a new teach session), and KEY1 still comes from the teach rule`, async () => {
    const { svc, store, trips } = await counted();
    const tour = await svc.startTour();
    if (!tour.ok) throw new Error(tour.reason);
    const fresh = await trips(() => svc.tourSkipAhead(tour.studentId)); // no teach session yet: one is started
    expect(fresh.out).toEqual({ ok: true, state: "KEY1" });
    expect(fresh.n).toBeLessThanOrEqual(LIMITS.tourSkipNewSession);

    const other = await svc.startTour();
    if (!other.ok) throw new Error(other.reason);
    const session = await svc.startTeach(other.studentId, TOUR_SKILL); // what stop 2 does
    if (!session.ok) throw new Error(session.reason);
    const skip = await trips(() => svc.tourSkipAhead(other.studentId));
    expect(skip.out).toEqual({ ok: true, state: "KEY1" });
    expect(skip.n).toBeLessThanOrEqual(LIMITS.tourSkip);
    const evidence = JSON.parse((await store.getMastery(other.studentId, TOUR_SKILL))!.evidenceJson);
    expect(evidence.key1.sessionId).toBe(session.sessionId);
  });

  it(`a student login takes at most ${LIMITS.studentLogin}; the health check at most ${LIMITS.health} (${LIMITS.health + LIMITS.cleanUp} when the hourly clean-up runs)`, async () => {
    const { svc, trips, clock } = await counted();
    const { room } = await classOf40(svc);
    const login = await trips(() => svc.studentLogin(room.classCode, room.studentCodes[3]));
    expect(login.out.ok).toBe(true);
    expect(login.n).toBeLessThanOrEqual(LIMITS.studentLogin);
    const first = await trips(() => svc.health());
    expect(first.n).toBeLessThanOrEqual(LIMITS.health + LIMITS.cleanUp);
    clock.advanceMinutes(10);
    const second = await trips(() => svc.health()); // no clean-up within the hour: one trivial read
    expect(second.n).toBeLessThanOrEqual(LIMITS.health - 1);
  });

  it(`the hourly clean-up deletes any number of expired tours in at most ${LIMITS.cleanUp} round trips`, async () => {
    const { svc, store, trips, clock } = await counted();
    const tours = [];
    for (let i = 0; i < 3; i++) {
      const tour = await svc.startTour();
      if (!tour.ok) throw new Error(tour.reason);
      tours.push(tour.classId);
    }
    clock.advanceHours(25);
    const { n, out } = await trips(() => svc.cleanUpSandboxes());
    expect(out).toEqual({ ran: true, deleted: 3 });
    expect(n).toBeLessThanOrEqual(LIMITS.cleanUp);
    for (const id of tours) expect(await store.getClass(id)).toBeUndefined();
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

  it(`saving a paper worksheet for ${CLASS_SIZE} children × 8 questions takes at most ${LIMITS.paperSave}; reading its grid at most 3`, async () => {
    const { svc, trips } = await counted();
    const { room } = await classOf40(svc);
    const ws = await svc.createWorksheet(room.classId, SKILL, 8);
    if (!ws.ok) throw new Error(ws.reason);
    const entries = room.studentCodes.flatMap((studentCode) =>
      ws.worksheet.questions.map((q) => ({ studentCode, question: q.n, text: q.n % 3 === 0 ? "9999" : "1" })),
    );
    const { n, out } = await trips(() => svc.savePaperAnswers(room.classId, ws.worksheet.code, entries));
    expect(out).toMatchObject({ ok: true, saved: CLASS_SIZE * 8 });
    expect(n).toBeLessThanOrEqual(LIMITS.paperSave);
    const grid = await trips(() => svc.getWorksheet(room.classId, ws.worksheet.code));
    expect(grid.out?.grid).toHaveLength(CLASS_SIZE);
    expect(grid.n).toBeLessThanOrEqual(3);
  });
});
