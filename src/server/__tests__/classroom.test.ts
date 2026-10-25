import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { SetupError } from "../instance";
import { createServices } from "../services";
import { openStore } from "../store";
import { answerProof, classroomReady, correctFix, makeClock, SKILL, tempDbUrl } from "./helpers";

/** Rows actually in the database file (read with a separate connection). */
async function rowCounts(url: string) {
  const db = createClient({ url });
  try {
    const n = async (table: string) => Number((await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
    return { classes: await n("classes"), students: await n("students") };
  } finally {
    db.close();
  }
}

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
    for (const code of room.studentCodes) expect(code).toMatch(/^8B-[A-HJKMNP-Z2-9]{4}$/); // random: see codes-throttle-window.test.ts
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

  it("checks every precondition (the server settings too) BEFORE writing anything", async () => {
    const { url, cleanup: rm } = tempDbUrl();
    const store = await openStore({ url });
    cleanup = () => {
      store.close();
      rm();
    };
    const order: string[] = [];
    const spied = new Proxy(store, {
      get: (target, key) =>
        key === "transaction" || key === "insertClass" || key === "insertStudent"
          ? (...args: unknown[]) => (order.push(String(key)), (target[key] as (...a: unknown[]) => unknown)(...args))
          : target[key as keyof typeof target],
    });
    const svc = createServices(spied, {
      checkSetup: () => {
        order.push("checkSetup");
        throw new SetupError("SESSION_SECRET", "SESSION_SECRET (32+ characters) must be set in production.");
      },
    });
    await expect(svc.createClassroom({ grade: 8, section: "Q", studentCount: 3 })).rejects.toBeInstanceOf(SetupError);
    expect(order).toEqual(["checkSetup"]);
    expect(await rowCounts(url)).toEqual({ classes: 0, students: 0 });
    // bad input is refused before the settings are even looked at
    order.length = 0;
    await expect(svc.createClassroom({ grade: 6, section: "Q", studentCount: 3 })).rejects.toThrow(/Grade/);
    expect(order).toEqual([]);
  });

  it("writes the class, its PIN and its students in one transaction: a failure halfway leaves nothing", async () => {
    const { url, cleanup: rm } = tempDbUrl();
    const store = await openStore({ url });
    cleanup = () => {
      store.close();
      rm();
    };
    let students = 0;
    const failing = new Proxy(store, {
      get: (target, key) =>
        key === "insertStudent"
          ? async (...args: Parameters<typeof store.insertStudent>) => {
              if (++students === 2) throw new Error("database went away");
              return target.insertStudent(...args);
            }
          : target[key as keyof typeof target],
    });
    const svc = createServices(failing, { checkSetup: () => {} });
    await expect(svc.createClassroom({ grade: 8, section: "Q", studentCount: 3 })).rejects.toThrow("database went away");
    expect(await rowCounts(url)).toEqual({ classes: 0, students: 0 });
    expect((await svc.createClassroom({ grade: 8, section: "Q", studentCount: 1 })).studentCodes).toEqual([expect.stringMatching(/^8Q-/)]);
  });

  it("Class 7 has AI off", async () => {
    const { svc, store } = await fresh();
    const room = await svc.createClassroom({ grade: 7, section: "A", studentCount: 2 });
    expect((await store.getClass(room.classId))!.aiAllowed).toBe(false);
  });
});

describe("logging in", () => {
  it("a teacher needs the right PIN, and is locked out after 5 wrong tries", async () => {
    const { svc } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 2 });
    expect(await svc.verifyTeacherPin(room.classCode, room.pin)).toEqual({ ok: true, classId: room.classId });
    const wrong = room.pin === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await svc.verifyTeacherPin(room.classCode, wrong)).ok).toBe(false);
    expect(await svc.verifyTeacherPin(room.classCode, room.pin)).toMatchObject({ ok: false, code: "locked_out" });
    expect((await svc.verifyTeacherPin("NOPE-0000", room.pin)).ok).toBe(false);
  });

  it("a student logs in with class code + student code (case and spaces do not matter)", async () => {
    const { svc } = await fresh();
    const room = await classroomReady(svc, { grade: 8, section: "B", studentCount: 5 });
    const r = await svc.studentLogin(` ${room.classCode.toLowerCase()} `, ` ${room.studentCodes[2].toLowerCase()}`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(await svc.getStudentContext(r.studentId)).toMatchObject({ code: room.studentCodes[2], grade: 8, aiAllowed: true });
    expect((await svc.studentLogin(room.classCode, "8B-99")).ok).toBe(false);
    expect((await svc.studentLogin("XX-0000", "8B-01")).ok).toBe(false);
  });
});

describe("skill map, class progress and unlocking", () => {
  it("shows every skill's state and counts states for the class", async () => {
    const { svc } = await fresh();
    const room = await classroomReady(svc, { grade: 8, section: "B", studentCount: 3 });
    const login = await svc.studentLogin(room.classCode, room.studentCodes[0]);
    if (!login.ok) throw new Error();
    const chain = ["alg.integers.ops", "alg.like-terms", "alg.linear.one-step", "alg.linear.two-step", SKILL];
    // the first skill has no prerequisite, so it is open at once; the rest wait for the one before (or a teacher)
    expect(await svc.getSkillMap(login.studentId)).toEqual(chain.map((skillId, i) => ({ skillId, state: i === 0 ? "OPEN" : "LOCKED" })));
    expect(await svc.teacherUnlockClass(room.classId, SKILL)).toBe(3);
    expect((await svc.getSkillMap(login.studentId)).at(-1)).toEqual({ skillId: SKILL, state: "OPEN" });
    const progress = await svc.getClassProgress(room.classId);
    expect(progress.map((p) => p.skillId)).toEqual(chain);
    expect(progress[0].counts).toEqual({ LOCKED: 0, OPEN: 3, KEY1: 0, NOT_YET: 0, MASTERED: 0 });
    expect(progress[1].counts).toEqual({ LOCKED: 3, OPEN: 0, KEY1: 0, NOT_YET: 0, MASTERED: 0 });
    expect(progress[4].counts).toEqual({ LOCKED: 0, OPEN: 3, KEY1: 0, NOT_YET: 0, MASTERED: 0 });
  });
});

describe("proof status, resume and the result", () => {
  it("resumes an open proof, and the result lists what to practise", async () => {
    const { svc, store } = await fresh(24);
    const room = await classroomReady(svc, { grade: 8, section: "B", studentCount: 1 });
    const login = await svc.studentLogin(room.classCode, room.studentCodes[0]);
    if (!login.ok) throw new Error();
    const id = login.studentId;
    await svc.teacherUnlockClass(room.classId, SKILL);
    expect(await svc.proofStatus(id, SKILL)).toMatchObject({ canStart: false, code: "not_ready" });
    await svc.openProofWindow(room.classId); // a class made now needs the teacher to open proofs

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
