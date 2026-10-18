import { afterEach, describe, expect, it } from "vitest";
import { createServices } from "../services";
import { openStore } from "../store";
import { answerProof, correctFix, makeClock, SKILL, tempDbUrl } from "./helpers";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function fresh(cooldownHours = 24) {
  const { url, cleanup: rm } = tempDbUrl();
  const store = await openStore({ url });
  const clock = makeClock();
  const svc = createServices(store, { now: clock.now, cooldownHours });
  cleanup = () => {
    store.close();
    rm();
  };
  return { store, clock, svc };
}

describe("creating a class", () => {
  it("gives a class code, a 6-digit PIN and printable student codes, with no names", async () => {
    const { svc, store } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 40 });
    expect(room.classCode).toMatch(/^8B-[A-Z0-9]{4}$/);
    expect(room.pin).toMatch(/^\d{6}$/);
    expect(room.studentCodes).toHaveLength(40);
    expect(room.studentCodes[0]).toBe("8B-01");
    expect(room.studentCodes[39]).toBe("8B-40");
    expect(await svc.listStudentCodes(room.classId)).toEqual(room.studentCodes);
    const row = (await store.getClass(room.classId))!;
    expect(row).toMatchObject({ grade: 8, section: "B", aiAllowed: true });
    expect(JSON.stringify(row)).not.toContain(room.pin); // only a salted hash is stored
  });

  it("allows only grades 7–9, one section letter and 1–60 students", async () => {
    const { svc } = await fresh();
    await expect(svc.createClassroom({ grade: 6, section: "A", studentCount: 10 })).rejects.toThrow();
    await expect(svc.createClassroom({ grade: 8, section: "Rahul", studentCount: 10 })).rejects.toThrow();
    await expect(svc.createClassroom({ grade: 8, section: "A", studentCount: 0 })).rejects.toThrow();
    await expect(svc.createClassroom({ grade: 8, section: "A", studentCount: 61 })).rejects.toThrow();
    expect((await svc.createClassroom({ grade: 7, section: "c", studentCount: 3 })).classCode).toMatch(/^7C-/);
  });

  it("Class 7 has AI off", async () => {
    const { svc, store } = await fresh();
    const room = await svc.createClassroom({ grade: 7, section: "A", studentCount: 2 });
    expect((await store.getClass(room.classId))!.aiAllowed).toBe(false);
  });
});

describe("logging in", () => {
  it("a teacher needs the right PIN, and is locked out after 10 wrong tries", async () => {
    const { svc } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 2 });
    expect(await svc.verifyTeacherPin(room.classCode, room.pin)).toEqual({ ok: true, classId: room.classId });
    const wrong = room.pin === "000000" ? "111111" : "000000";
    for (let i = 0; i < 10; i++) expect((await svc.verifyTeacherPin(room.classCode, wrong)).ok).toBe(false);
    expect(await svc.verifyTeacherPin(room.classCode, room.pin)).toMatchObject({ ok: false, code: "locked_out" });
    expect((await svc.verifyTeacherPin("NOPE-0000", room.pin)).ok).toBe(false);
  });

  it("a student logs in with class code + student code (case and spaces do not matter)", async () => {
    const { svc } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 5 });
    const r = await svc.studentLogin(` ${room.classCode.toLowerCase()} `, "8b-03");
    expect(r.ok).toBe(true);
    if (r.ok) expect(await svc.getStudentContext(r.studentId)).toMatchObject({ code: "8B-03", grade: 8, aiAllowed: true });
    expect((await svc.studentLogin(room.classCode, "8B-99")).ok).toBe(false);
    expect((await svc.studentLogin("XX-0000", "8B-01")).ok).toBe(false);
  });
});

describe("skill map, class progress and unlocking", () => {
  it("shows every skill's state and counts states for the class", async () => {
    const { svc } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 3 });
    const login = await svc.studentLogin(room.classCode, "8B-01");
    if (!login.ok) throw new Error();
    expect(await svc.getSkillMap(login.studentId)).toEqual([{ skillId: SKILL, state: "LOCKED" }]);
    expect(await svc.teacherUnlockClass(room.classId, SKILL)).toBe(3);
    expect(await svc.getSkillMap(login.studentId)).toEqual([{ skillId: SKILL, state: "OPEN" }]);
    expect(await svc.getClassProgress(room.classId)).toEqual([
      { skillId: SKILL, counts: { LOCKED: 0, OPEN: 3, KEY1: 0, NOT_YET: 0, MASTERED: 0 } },
    ]);
  });
});

describe("proof status, resume and the result", () => {
  it("resumes an open proof, and the result lists what to practise", async () => {
    const { svc, store } = await fresh(24);
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 1 });
    const login = await svc.studentLogin(room.classCode, "8B-01");
    if (!login.ok) throw new Error();
    const id = login.studentId;
    await svc.teacherUnlockClass(room.classId, SKILL);
    expect(await svc.proofStatus(id, SKILL)).toMatchObject({ canStart: false, code: "not_ready" });

    const s = await svc.startTeach(id, SKILL);
    if (!s.ok) throw new Error();
    for (const tr of s.traces) {
      const fix = await correctFix(store, tr.itemId);
      await svc.submitTeachStep(tr.itemId, fix.line, fix.text);
    }
    expect(await svc.proofStatus(id, SKILL)).toEqual({ canStart: true });
    expect(await svc.resumeProof(id, SKILL)).toMatchObject({ ok: false, code: "none" });

    const run = await svc.startProof(id, SKILL);
    if (!run.ok) throw new Error();
    expect(await svc.proofStatus(id, SKILL)).toMatchObject({ canStart: false, code: "running" });
    const resumed = await svc.resumeProof(id, SKILL);
    expect(resumed).toMatchObject({ ok: true, runId: run.runId });
    if (resumed.ok) expect(resumed.items.map((i) => i.answered)).toEqual([false, false, false, false]);
    expect(await svc.getItemOwner(run.items[0].itemId)).toBe(id);

    const last = await answerProof(svc, store, run.items.map((i) => i.itemId), 1);
    expect(last).toMatchObject({ finished: true, passed: false, state: "NOT_YET" });
    if (last.ok && last.finished) expect(last.practise.length).toBe(1);
    expect(await svc.proofStatus(id, SKILL)).toMatchObject({ canStart: false, code: "cooldown", retryAt: expect.any(String) });
  });
});

describe("projector mode (no student accounts)", () => {
  it("serves a Shishya trace and checks the class's fix", async () => {
    const { svc, store } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 1 });
    const trace = await svc.projectorTrace(room.classId, SKILL);
    expect(trace.lines).toHaveLength(5);
    const bad = await svc.projectorCheck(room.classId, SKILL, trace.seed, trace.mistakeId, 1, trace.lines[1]);
    expect(bad.lineCorrect).toBe(false);
    const events = await store.listEvents();
    const types = events.map((e) => e.type);
    expect(types).toContain("projector_trace");
    expect(types).toContain("projector_step");
    expect(events.every((e) => e.studentId === null || !e.type.startsWith("projector"))).toBe(true);
  });
});

describe("mined mistakes waiting for the teacher", () => {
  it("lists tested drafts, refuses to approve one that is not valid data, and records a decision once", async () => {
    const { svc, store, clock } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 1 });
    expect(await svc.listPendingMinedMistakes()).toEqual([]);
    await store.insertMinedMistake({
      id: "mm1",
      skillId: SKILL,
      source: "export function apply() {}", // code, not mined-mistake data: can never be approved
      testsJson: "{}",
      status: "DRAFT_TESTED",
      approver: null,
      createdAt: clock.now().toISOString(),
    });
    expect((await svc.listPendingMinedMistakes()).map((m) => m.id)).toEqual(["mm1"]);
    expect(await svc.decideMinedMistake(room.classId, "mm1", "approved")).toMatchObject({ ok: false });
    expect(await svc.decideMinedMistake(room.classId, "mm1", "rejected")).toEqual({ ok: true });
    expect(await svc.decideMinedMistake(room.classId, "mm1", "rejected")).toMatchObject({ ok: false });
    expect(await svc.listPendingMinedMistakes()).toEqual([]);
  });
});
