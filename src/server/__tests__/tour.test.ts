import { afterEach, describe, expect, it } from "vitest";
import { parseAnswerFor, sameAnswer } from "../../core/answer";
import { diagnose } from "../../core/diagnose";
import { checkTeachStep } from "../../core/teach";
import * as mastery from "../mastery";
import { createServices } from "../services";
import { defaultRegistry, instanceFor } from "../skills";
import { openStore, type Store } from "../store";
import { TOUR_CLASSMATE_CODE, TOUR_JUDGE_CODE, TOUR_MAX_PER_HOUR, TOUR_SKILL } from "../tour";
import { answerProof, correctFix, makeClock, SKILL, teachPerfectly, tempDbUrl } from "./helpers";

// The Judge Tour: a made-up (sandbox) class with a fixed picture, so a judge can click everything alone in about
// 3 minutes. Every seeded number is re-checkable by src/core, and nothing done in a tour reaches real data.

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function fresh() {
  const tmp = tempDbUrl();
  const store = await openStore({ url: tmp.url });
  const clock = makeClock();
  const svc = createServices(store, { now: clock.now, cooldownHours: 24 });
  cleanup = () => {
    store.close();
    tmp.cleanup();
  };
  return { store, svc, clock };
}

type Svc = ReturnType<typeof createServices>;

async function startTour(svc: Svc) {
  const tour = await svc.startTour();
  if (!tour.ok) throw new Error(tour.reason);
  return tour;
}

/** The board as numbers only (what a judge sees), without the ids that differ between tours. */
async function boardNumbers(svc: Svc, classId: string) {
  const board = await svc.getClassBoard(classId);
  return { stuck: board.stuck, progress: board.progress, codes: board.codes };
}

describe("starting a tour", () => {
  it("makes a sandbox class (grade 8, 24 hours, no proof window) with the judge's child and 30 made-up children", async () => {
    const { store, svc, clock } = await fresh();
    const tour = await startTour(svc);
    const cls = (await store.getClass(tour.classId))!;
    expect(cls).toMatchObject({ grade: 8, kind: "sandbox", proofWindowRequired: false, aiAllowed: true });
    expect(cls.expiresAt).toBe(new Date(clock.t + 24 * 3600_000).toISOString());
    const students = await store.listStudents(tour.classId);
    expect(students).toHaveLength(31);
    expect(students.find((s) => s.id === tour.studentId)!.code).toBe(TOUR_JUDGE_CODE);
    expect(tour.classCode).toBe(cls.code);
    // the judge starts on the skill of the tour, open, with the skills before it mastered
    const map = await svc.getSkillMap(tour.studentId);
    expect(map.find((s) => s.skillId === TOUR_SKILL)!.state).toBe("OPEN");
    expect(map.filter((s) => s.skillId !== TOUR_SKILL).every((s) => s.state === "MASTERED")).toBe(true);
  });

  it("seeds the picture: 14 patterns at line 3 (kept the sign of the number), 6 divide-the-wrong-way patterns, 5 slips, a spread of states", async () => {
    const { svc } = await fresh();
    const tour = await startTour(svc);
    const board = await svc.getClassBoard(tour.classId);
    const kept = board.stuck.groups.find((g) => g.skillId === TOUR_SKILL && g.mistakeId === "kept-const-sign")!;
    expect(kept.count).toBe(14);
    expect(kept.students.every((s) => s.line === 3 && s.questions >= 2)).toBe(true);
    const divide = board.stuck.groups.find((g) => g.mistakeId === "divided-wrong-way")!;
    expect(divide).toMatchObject({ skillId: "alg.linear.one-step", count: 6 });
    expect(board.stuck.groups).toHaveLength(2);
    expect(board.stuck.slips.flatMap((s) => s.students)).toHaveLength(5);
    expect(board.stuck.grid.rows.find((r) => r.skillId === TOUR_SKILL)!.counts).toEqual([0, 14, 0, 0]);

    const all = board.progress.flatMap((p) => Object.entries(p.counts).filter(([, n]) => n > 0).map(([s]) => s));
    for (const state of ["MASTERED", "KEY1", "OPEN"]) expect(all).toContain(state);
    const both = board.progress.find((p) => p.skillId === TOUR_SKILL)!.counts;
    expect(both.MASTERED).toBeGreaterThan(0);
    expect(both.KEY1).toBeGreaterThan(0);
    expect(both.OPEN).toBeGreaterThan(14);
    expect(board.codes).toContain(TOUR_JUDGE_CODE);
    expect(board.mined).toEqual([]); // the real library's drafts are never shown in a tour
  });

  it("is deterministic: two tours give the same board numbers", async () => {
    const { svc, clock } = await fresh();
    const first = await startTour(svc);
    clock.advanceHours(5);
    const second = await startTour(svc);
    expect(second.classCode).not.toBe(first.classCode);
    clock.advanceMinutes(1);
    expect(await boardNumbers(svc, second.classId)).toEqual(await boardNumbers(svc, first.classId));
  });

  it("every seeded answer re-checks: re-computing from its seed gives the stored correct / mistake verdict; seeded proofs verify", async () => {
    const { store, svc } = await fresh();
    const tour = await startTour(svc);
    const students = (await store.listStudents(tour.classId)).filter((s) => s.id !== tour.studentId);
    let checked = 0;
    let proofs = 0;
    for (const s of students) {
      for (const entry of Object.values(defaultRegistry)) {
        const items = await store.listItems({ studentId: s.id, skillId: entry.spec.id });
        const attempts = await store.listAttemptsForItems(items.map((i) => i.id));
        for (const a of attempts) {
          const item = items.find((i) => i.id === a.itemId)!;
          const inst = instanceFor(entry, item);
          expect(JSON.stringify(inst.params)).toBe(item.paramsJson);
          const typed = parseAnswerFor(entry.spec.answerKind, a.answer);
          if (!typed.ok) throw new Error(a.answer);
          expect(sameAnswer(typed.value, inst.answer), `${entry.spec.id} ${a.answer}`).toBe(a.correct);
          if (!a.correct) expect(diagnose(entry.spec, inst, typed.value)).toBe(a.mistakeId);
          checked++;
        }
        const run = await store.getLastFinishedProofRun(s.id, entry.spec.id);
        if (run) {
          expect(await mastery.verifyProofRun(store, entry, run)).toEqual({ passed: true, reasons: [] });
          const row = (await store.getMastery(s.id, entry.spec.id))!;
          expect(row.state).toBe("MASTERED");
          expect(JSON.parse(row.evidenceJson).proof.runId).toBe(run.id);
          proofs++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(proofs).toBeGreaterThanOrEqual(1);
  });

  it(`the ${TOUR_MAX_PER_HOUR + 1}st tour in an hour is refused politely; an hour later tours start again`, async () => {
    const { store, svc, clock } = await fresh();
    for (let i = 0; i < TOUR_MAX_PER_HOUR; i++) await startTour(svc);
    const classesBefore = (await store.listEvents()).filter((e) => e.type === "tour_started").length;
    const refused = await svc.startTour();
    expect(refused).toMatchObject({ ok: false, code: "busy" });
    if (!refused.ok) expect(refused.reason).toMatch(/try again/i);
    expect((await store.listEvents()).filter((e) => e.type === "tour_started").length).toBe(classesBefore);
    clock.advanceMinutes(61);
    expect((await svc.startTour()).ok).toBe(true);
  });

  it("starting a tour cleans up sandboxes that have expired (lazily)", async () => {
    const { store, svc, clock } = await fresh();
    const old = await startTour(svc);
    clock.advanceHours(25);
    await startTour(svc);
    expect(await store.getClass(old.classId)).toBeUndefined();
  });
});

describe("mastery seeding is for sandbox classes only", () => {
  it("refuses a real or test class, and a student who is not in the sandbox class", async () => {
    const { store, svc, clock } = await fresh();
    const real = await svc.createClass("KV8B", 8);
    const child = await svc.createStudent(real.id, "8B-17");
    const seed = [{ studentId: child.id, skillId: SKILL, state: "MASTERED" as const }];
    await expect(mastery.seedSandboxMastery(store, real.id, seed, clock.now())).rejects.toThrow(/sandbox/);
    await store.insertClass({ id: "t1", code: "8Q-TEST", grade: 8, section: "Q", aiAllowed: true, proofWindowRequired: false, proofWindowOpenUntil: null, kind: "test" });
    await expect(mastery.seedSandboxMastery(store, "t1", seed, clock.now())).rejects.toThrow(/sandbox/);
    const tour = await startTour(svc);
    await expect(mastery.seedSandboxMastery(store, tour.classId, seed, clock.now())).rejects.toThrow(/not in/);
    expect(await store.getMastery(child.id, SKILL)).toBeUndefined();
  });
});

describe("skip ahead (stop 3)", () => {
  it("finishes the judge's teaching THROUGH the real teach code, so KEY1 is earned by the normal rule", async () => {
    const { store, svc } = await fresh();
    const tour = await startTour(svc);
    // the judge starts teaching and gets the first line wrong once
    const session = await svc.startTeach(tour.studentId, TOUR_SKILL);
    if (!session.ok) throw new Error(session.reason);
    const fix = await correctFix(store, session.traces[0].itemId);
    expect(await svc.submitTeachStep(session.traces[0].itemId, fix.line, "x = 1000")).toMatchObject({ ok: true, fixAccepted: false });

    expect(await svc.tourSkipAhead(tour.studentId)).toEqual({ ok: true, state: "KEY1" });
    const row = (await store.getMastery(tour.studentId, TOUR_SKILL))!;
    const evidence = JSON.parse(row.evidenceJson);
    expect(row.state).toBe("KEY1");
    expect(evidence.key1.sessionId).toBe(session.sessionId); // the judge's own session, finished
    const entry = defaultRegistry[TOUR_SKILL];
    for (const [i, itemId] of evidence.key1.itemIds.entries()) {
      const item = (await store.getItem(itemId))!;
      const trace = (await store.listTeachTraces(itemId)).find((t) => t.id === evidence.key1.traceIds[i])!;
      expect(checkTeachStep(instanceFor(entry, item), item.mistakeId!, trace.tappedLine, trace.typedLine, entry.spec.mistakes)).toMatchObject({
        lineCorrect: true,
        fixAccepted: true,
      });
    }
    const steps = (await store.listEvents()).filter((e) => e.type === "teach_step" && e.studentId === tour.studentId);
    expect(steps).toHaveLength(4); // the judge's wrong try + 3 accepted fixes, each a real teach step

    // the proof then opens at once (no window, no cooldown in a tour), and a failed one can be tried again at once
    const proof = await svc.startProof(tour.studentId, TOUR_SKILL);
    if (!proof.ok) throw new Error(proof.reason);
    expect((await answerProof(svc, store, proof.items.map((i) => i.itemId), 0))).toMatchObject({ finished: true, passed: false });
    const again = await svc.startProof(tour.studentId, TOUR_SKILL);
    if (!again.ok) throw new Error(again.reason);
    expect(await answerProof(svc, store, again.items.map((i) => i.itemId))).toMatchObject({ finished: true, passed: true, state: "MASTERED" });

    // stop 4: the receipts of the finished proof; stop 3's panel: a classmate's proof with different numbers
    const receipts = (await svc.lastProofReceipts(tour.studentId, TOUR_SKILL))!;
    expect(receipts).toHaveLength(4);
    expect(receipts.every((r) => r.receipt && "holds" in r.receipt && r.receipt.holds)).toBe(true);
    const classmate = (await svc.tourClassmateProof(tour.studentId))!;
    expect(classmate.code).toBe(TOUR_CLASSMATE_CODE);
    expect(classmate.questions).toHaveLength(4);
    expect(classmate.questions.map((q) => q.format)).toEqual(["solve", "solve", "solve", "apply"]);
    const mine = new Set(again.items.map((i) => i.text));
    expect(classmate.questions.some((q) => mine.has(q.text))).toBe(false);
  });

  it("starts a new teach session when the judge's last one can no longer meet the rule; refuses outside a tour", async () => {
    const { store, svc } = await fresh();
    const tour = await startTour(svc);
    const session = await svc.startTeach(tour.studentId, TOUR_SKILL);
    if (!session.ok) throw new Error(session.reason);
    const first = session.traces[0].itemId;
    const fix = await correctFix(store, first);
    await svc.submitTeachStep(first, fix.line, "x = 1000");
    await svc.submitTeachStep(first, fix.line, "x = 1001"); // no tries left: this session can never qualify
    expect(await svc.tourSkipAhead(tour.studentId)).toEqual({ ok: true, state: "KEY1" });
    const evidence = JSON.parse((await store.getMastery(tour.studentId, TOUR_SKILL))!.evidenceJson);
    expect(evidence.key1.sessionId).not.toBe(session.sessionId);

    const real = await svc.createClass("KV8B", 8);
    const child = await svc.createStudent(real.id, "8B-17");
    await svc.teacherUnlock(child.id, SKILL);
    expect(await svc.tourSkipAhead(child.id)).toMatchObject({ ok: false, code: "not_tour" });
    expect(await svc.getState(child.id, SKILL)).toBe("OPEN");
  });
});

/** Everything a tour could possibly touch outside its own class. */
async function realSnapshot(store: Store, svc: Svc, classId: string, studentId: string) {
  return {
    counts: await store.exportCounts(classId),
    mastery: await store.listMastery({ classId }),
    unknown: await store.listUnknownErrors(SKILL),
    mined: [
      ...(await store.listMinedMistakes("DRAFT_TESTED")),
      ...(await store.listMinedMistakes("APPROVED")),
      ...(await store.listMinedMistakes("REJECTED")),
    ],
    cls: await store.getClass(classId),
    students: await store.listStudents(classId),
    events: (await store.listEvents()).filter((e) => e.studentId === studentId).length,
    csv: await svc.exportPilotCsv(classId),
  };
}

describe("nothing done in a tour changes real data", () => {
  it("real classes, the mistake library, unknownErrors and impact numbers are the same after a whole tour", async () => {
    const { store, svc, clock } = await fresh();
    const real = await svc.createClass("KV8B", 8);
    const child = await svc.createStudent(real.id, "8B-17");
    await svc.teacherUnlock(child.id, SKILL);
    const item = await svc.servePracticeItem(child.id, SKILL);
    if (!item.ok) throw new Error(item.reason);
    await svc.submitPracticeAnswer(item.itemId, "1000"); // a real unknown answer, logged for the Miner
    await teachPerfectly(svc, store, child.id);
    await store.insertMinedMistake({
      id: "draft-1",
      skillId: SKILL,
      source: JSON.stringify({ id: "x" }),
      testsJson: "{}",
      status: "DRAFT_TESTED",
      approver: null,
      createdAt: clock.now().toISOString(),
    });
    const before = await realSnapshot(store, svc, real.id, child.id);

    // the whole tour
    const tour = await startTour(svc);
    for (const answer of ["1000", "1001"]) {
      const p = await svc.servePracticeItem(tour.studentId, TOUR_SKILL);
      if (!p.ok) throw new Error(p.reason);
      await svc.submitPracticeAnswer(p.itemId, answer);
    }
    expect(await svc.tourSkipAhead(tour.studentId)).toEqual({ ok: true, state: "KEY1" });
    const proof = await svc.startProof(tour.studentId, TOUR_SKILL);
    if (!proof.ok) throw new Error(proof.reason);
    for (const p of proof.items) await svc.submitProofAnswer(p.itemId, "1000");
    await svc.getClassBoard(tour.classId);
    await svc.teacherUnlockClass(tour.classId, SKILL);
    await svc.openProofWindow(tour.classId);
    // a tour teacher cannot decide drafts of the real mistake library
    expect(await svc.decideMinedMistake(tour.classId, "draft-1", "approved")).toMatchObject({ ok: false });
    expect(await svc.decideMinedMistake(tour.classId, "draft-1", "rejected")).toMatchObject({ ok: false });
    await svc.exportPilotCsv(tour.classId);

    expect(await realSnapshot(store, svc, real.id, child.id)).toEqual({ ...before, events: before.events, csv: before.csv });
    // and once the tour has expired, it is gone and the real class is still exactly the same
    clock.advanceHours(25);
    await svc.cleanUpSandboxes();
    expect(await store.getClass(tour.classId)).toBeUndefined();
    expect(await realSnapshot(store, svc, real.id, child.id)).toEqual(before);
  });
});
