import { afterEach, describe, expect, it } from "vitest";
import { createServices } from "../services";
import { openStore } from "../store";
import { answerProof, makeClock, SKILL, teachPerfectly, tempDbUrl } from "./helpers";

// F3: nobody can log in as a classmate, and a proof opens only when the teacher opens it.
// Student codes are random; wrong logins and wrong PINs are counted in the database (so every server instance
// sees the same count); a class made now needs the teacher to open a proof window.

const NEW_CODE = /^8B-[A-HJKMNP-Z2-9]{4}$/; // 4 characters, never 0/O/1/I/L

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function fresh() {
  const { url, cleanup: rm } = tempDbUrl();
  const store = await openStore({ url });
  const clock = makeClock();
  const opts = { now: clock.now, cooldownHours: 24 };
  const svc = createServices(store, opts);
  cleanup = () => {
    store.close();
    rm();
  };
  /** Another server instance on the same database (its own memory). */
  const another = () => createServices(store, opts);
  return { store, clock, svc, another };
}

async function loginId(svc: ReturnType<typeof createServices>, classCode: string, code: string) {
  const r = await svc.studentLogin(classCode, code);
  if (!r.ok) throw new Error(r.reason);
  return r.studentId;
}

describe("random student codes", () => {
  it("new classes get codes like 8B-K7QM: unique in the class, never 0, O, 1, I or L", async () => {
    const { svc } = await fresh();
    for (let i = 0; i < 5; i++) {
      const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 60 });
      expect(room.studentCodes).toHaveLength(60);
      expect(new Set(room.studentCodes).size).toBe(60);
      for (const code of room.studentCodes) {
        expect(code).toMatch(NEW_CODE);
        expect(code.slice(3)).not.toMatch(/[0O1IL]/);
      }
      expect([...(await svc.listStudentCodes(room.classId))].sort()).toEqual([...room.studentCodes].sort());
      expect(await svc.studentLogin(room.classCode, room.studentCodes[0].toLowerCase())).toMatchObject({ ok: true });
    }
  });

  it("old codes like 8B-17 are still accepted and still log in", async () => {
    const { svc } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 1 });
    const old = await svc.createStudent(room.classId, "8B-17");
    expect(await svc.studentLogin(room.classCode, "8b-17")).toEqual({ ok: true, studentId: old.id });
    await expect(svc.createStudent(room.classId, "8B-K7QM")).resolves.toMatchObject({ code: "8B-K7QM" });
    await expect(svc.createStudent(room.classId, "Rahul")).rejects.toThrow();
    await expect(svc.createStudent(room.classId, "8B-K7Q0")).rejects.toThrow(); // 0 is not in the alphabet
  });
});

describe("giving a class new codes", () => {
  it("changes every code; ids, mastery and history stay; old codes stop working", async () => {
    const { svc, store } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 30 });
    const id = await loginId(svc, room.classCode, room.studentCodes[0]);
    await svc.teacherUnlockClass(room.classId, SKILL);
    await teachPerfectly(svc, store, id);
    const studentsBefore = await store.listStudents(room.classId);
    const masteryOf = async () =>
      (await store.listMastery({ classId: room.classId })).sort((a, b) => `${a.studentId}${a.skillId}`.localeCompare(`${b.studentId}${b.skillId}`));
    const masteryBefore = await masteryOf();
    const eventsBefore = (await store.listEvents()).length;

    const codes = await svc.reissueStudentCodes(room.classId);

    expect(codes).toHaveLength(30);
    expect(new Set(codes).size).toBe(30);
    for (const c of codes) expect(c).toMatch(NEW_CODE);
    expect(codes.filter((c) => room.studentCodes.includes(c))).toEqual([]);
    const studentsAfter = await store.listStudents(room.classId);
    expect(studentsAfter.map((s) => s.id).sort()).toEqual(studentsBefore.map((s) => s.id).sort());
    expect(await masteryOf()).toEqual(masteryBefore);
    expect([...(await svc.listStudentCodes(room.classId))].sort()).toEqual([...codes].sort());

    // the same child, with the new code
    const after = studentsAfter.find((s) => s.id === id)!;
    expect(await svc.studentLogin(room.classCode, after.code)).toEqual({ ok: true, studentId: id });
    expect(await svc.studentLogin(room.classCode, room.studentCodes[0])).toMatchObject({ ok: false, code: "wrong_codes" });

    const events = await store.listEvents();
    expect(events.length).toBeGreaterThan(eventsBefore);
    const logged = events.filter((e) => e.type === "codes_reissued");
    expect(logged).toHaveLength(1);
    expect(JSON.parse(logged[0].payloadJson)).toEqual({ classId: room.classId, students: 30 });
    for (const c of [...codes, ...room.studentCodes]) expect(logged[0].payloadJson).not.toContain(c);
  });
});

describe("wrong logins are counted in the database, not in memory", () => {
  it("after 5 wrong student codes, even a correct one is refused for 10 minutes, on every server instance", async () => {
    const { svc, another, clock, store } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 3 });
    const right = room.studentCodes[0];
    for (let i = 0; i < 5; i++) {
      expect(await svc.studentLogin(room.classCode, `8B-9${i}`)).toMatchObject({ ok: false, code: "wrong_codes" });
      clock.advanceMinutes(1);
    }
    // a second server instance (its own memory) sees the same count
    const other = another();
    expect(await other.studentLogin(room.classCode, right)).toMatchObject({ ok: false, code: "locked_out" });
    expect(await svc.studentLogin(room.classCode, right)).toMatchObject({ ok: false, code: "locked_out" });
    // 10 minutes after the 1st wrong code only 4 are left in the window
    clock.t = makeClock().t + 10 * 60_000 + 1000;
    expect(await other.studentLogin(room.classCode, right)).toMatchObject({ ok: true });

    // another class is never affected
    const room2 = await svc.createClassroom({ grade: 8, section: "C", studentCount: 1 });
    for (let i = 0; i < 5; i++) await svc.studentLogin(room.classCode, "8B-99");
    expect(await svc.studentLogin(room2.classCode, room2.studentCodes[0])).toMatchObject({ ok: true });

    // the log has no codes; an unknown class is logged with no class id
    expect(await svc.studentLogin("XX-9999", right)).toMatchObject({ ok: false, code: "wrong_codes" });
    const logins = (await store.listEvents()).filter((e) => e.type === "student_login");
    expect(logins.at(-1)).toMatchObject({ studentId: null });
    expect(JSON.parse(logins.at(-1)!.payloadJson)).toEqual({ classId: null, ok: false });
    for (const e of logins) expect(e.payloadJson).not.toMatch(/8B-|XX-/);
  });

  it("after 5 wrong teacher PINs, even the right PIN is refused for 15 minutes, on every server instance", async () => {
    const { svc, another, clock } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 1, pin: "123456" });
    for (let i = 0; i < 5; i++) {
      expect(await svc.verifyTeacherPin(room.classCode, "000000")).toMatchObject({ ok: false, code: "wrong_pin" });
      clock.advanceMinutes(1);
    }
    expect(await another().verifyTeacherPin(room.classCode, "123456")).toMatchObject({ ok: false, code: "locked_out" });
    clock.advanceMinutes(9); // 14 minutes after the 1st wrong PIN
    expect(await another().verifyTeacherPin(room.classCode, "123456")).toMatchObject({ ok: false, code: "locked_out" });
    clock.advanceMinutes(1.1); // 15 minutes after it: 4 wrong PINs left in the window
    expect(await another().verifyTeacherPin(room.classCode, "123456")).toEqual({ ok: true, classId: room.classId });
  });
});

describe("the proof opens only when the teacher opens it", () => {
  async function readyChild() {
    const ctx = await fresh();
    const room = await ctx.svc.createClassroom({ grade: 8, section: "B", studentCount: 1 });
    const id = await loginId(ctx.svc, room.classCode, room.studentCodes[0]);
    await ctx.svc.teacherUnlockClass(room.classId, SKILL);
    await teachPerfectly(ctx.svc, ctx.store, id);
    return { ...ctx, room, id };
  }

  it("is refused while the window is closed, and allowed while it is open", async () => {
    const { svc, room, id, clock } = await readyChild();
    expect(await svc.startProof(id, SKILL)).toMatchObject({ ok: false, code: "window_closed" });
    expect(await svc.proofStatus(id, SKILL)).toMatchObject({ canStart: false, code: "window_closed" });

    const opened = await svc.openProofWindow(room.classId);
    expect(opened.openUntil).toBe(new Date(clock.t + 15 * 60_000).toISOString());
    expect((await svc.getClassBoard(room.classId)).proofWindow).toEqual({ required: true, openUntil: opened.openUntil, minutesLeft: 15 });
    expect(await svc.proofStatus(id, SKILL)).toEqual({ canStart: true });

    await svc.closeProofWindow(room.classId);
    expect((await svc.getClassBoard(room.classId)).proofWindow).toMatchObject({ required: true, minutesLeft: 0 });
    expect(await svc.startProof(id, SKILL)).toMatchObject({ ok: false, code: "window_closed" });

    await svc.openProofWindow(room.classId);
    clock.advanceMinutes(15.1);
    expect(await svc.startProof(id, SKILL)).toMatchObject({ ok: false, code: "window_closed" });
    await svc.openProofWindow(room.classId);
    clock.advanceMinutes(14);
    expect(await svc.startProof(id, SKILL)).toMatchObject({ ok: true });
  });

  it("a proof started inside the window keeps its own 30 minutes after the window closes", async () => {
    const { svc, store, room, id, clock } = await readyChild();
    await svc.openProofWindow(room.classId);
    clock.advanceMinutes(10);
    const run = await svc.startProof(id, SKILL);
    if (!run.ok) throw new Error(run.reason);
    await svc.closeProofWindow(room.classId);
    clock.advanceMinutes(20); // window long closed; the proof's own 30 minutes are not up
    const resumed = await svc.resumeProof(id, SKILL);
    expect(resumed).toMatchObject({ ok: true, runId: run.runId });
    const last = await answerProof(svc, store, run.items.map((i) => i.itemId));
    expect(last).toMatchObject({ ok: true, finished: true, passed: true, state: "MASTERED" });
  });

  it("classes made before proof windows existed are not affected", async () => {
    const { svc, store, clock } = await fresh();
    const cls = await svc.createClass("KV8B", 8); // the older set-up path: no window needed
    const s = await svc.createStudent(cls.id, "8B-17");
    await svc.teacherUnlock(s.id, SKILL);
    await teachPerfectly(svc, store, s.id);
    clock.advanceMinutes(1);
    expect(await svc.startProof(s.id, SKILL)).toMatchObject({ ok: true });
    expect((await svc.getClassBoard(cls.id)).proofWindow).toEqual({ required: false, openUntil: null, minutesLeft: 0 });
  });
});
