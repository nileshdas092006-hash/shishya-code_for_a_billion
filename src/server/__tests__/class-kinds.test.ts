import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { createServices } from "../services";
import { openStore, type ClassKind, type Store } from "../store";
import { answerProof, makeClock, SKILL, teachPerfectly, tempDbUrl } from "./helpers";

// Class kinds: 'real' (a school class), 'test' (Das's own test classes, all 8Q-…) and 'sandbox' (a Judge Tour
// class, deleted after 24 hours). Anything pooled ACROSS classes (the Miner's unknownErrors, impact numbers)
// uses only real classes. A whole class can be deleted with everything that belongs to it.

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function fresh() {
  const tmp = tempDbUrl();
  const store = await openStore({ url: tmp.url });
  const clock = makeClock();
  const svc = createServices(store, { now: clock.now, cooldownHours: 0 });
  cleanup = () => {
    store.close();
    tmp.cleanup();
  };
  return { store, svc, clock, url: tmp.url };
}

let n = 0;
async function classOfKind(store: Store, kind: ClassKind, expiresAt: string | null = null) {
  const id = `class-${kind}-${++n}`;
  await store.insertClass({
    id,
    code: `K${n}-${kind.toUpperCase().slice(0, 4)}`,
    grade: 8,
    section: "B",
    aiAllowed: true,
    proofWindowRequired: false,
    proofWindowOpenUntil: null,
    kind,
    expiresAt,
  });
  return id;
}

/** A child who practises (one unknown wrong answer), teaches to KEY1 and passes a proof. */
async function busyChild(svc: ReturnType<typeof createServices>, store: Store, classId: string, code: string) {
  const student = await svc.createStudent(classId, code);
  await svc.teacherUnlock(student.id, SKILL);
  const item = await svc.servePracticeItem(student.id, SKILL);
  if (!item.ok) throw new Error(item.reason);
  await svc.submitPracticeAnswer(item.itemId, "1000"); // no known mistake gives 1000: "unknown"
  await teachPerfectly(svc, store, student.id);
  const proof = await svc.startProof(student.id, SKILL);
  if (!proof.ok) throw new Error(proof.reason);
  await answerProof(svc, store, proof.items.map((i) => i.itemId), 0); // first proof answer wrong
  return student;
}

describe("store migration: class kinds", () => {
  it("adds kind and expiresAt; every 8Q-… class becomes 'test', the others stay 'real'; running twice is safe", async () => {
    const tmp = tempDbUrl();
    cleanup = tmp.cleanup;
    const old = createClient({ url: tmp.url });
    await old.executeMultiple(`
      CREATE TABLE classes (
        id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
        section TEXT NOT NULL DEFAULT '', aiAllowed INTEGER NOT NULL CHECK (aiAllowed IN (0, 1)), teacherPinHash TEXT,
        proofWindowRequired INTEGER NOT NULL DEFAULT 1, proofWindowOpenUntil TEXT);
      INSERT INTO classes VALUES ('c1', '8Q-ENN4', 8, 'Q', 1, NULL, 1, NULL);
      INSERT INTO classes VALUES ('c2', '8B-K7QM', 8, 'B', 1, NULL, 1, NULL);
      INSERT INTO classes VALUES ('c3', 'KV8Q', 8, '', 1, NULL, 0, NULL);
    `);
    old.close();

    const store = await openStore({ url: tmp.url });
    expect(await store.getClass("c1")).toMatchObject({ code: "8Q-ENN4", kind: "test", expiresAt: null });
    expect(await store.getClass("c2")).toMatchObject({ code: "8B-K7QM", kind: "real", expiresAt: null });
    expect(await store.getClass("c3")).toMatchObject({ kind: "real" });
    store.close();

    const again = await openStore({ url: tmp.url });
    expect((await again.getClass("c1"))!.kind).toBe("test");
    expect((await again.getClass("c2"))!.kind).toBe("real");
    again.close();
  });

  it("a class made now is 'real' unless it says otherwise; an unknown kind is refused", async () => {
    const { store, svc } = await fresh();
    const made = await svc.createClass("KV8B", 8);
    expect((await store.getClass(made.id))!.kind).toBe("real");
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 2, pin: "123456" });
    expect((await store.getClass(room.classId))!.kind).toBe("real");
    await expect(
      store.insertClass({
        id: "x",
        code: "BAD-1",
        grade: 8,
        section: "",
        aiAllowed: true,
        proofWindowRequired: false,
        proofWindowOpenUntil: null,
        kind: "pretend" as ClassKind,
      }),
    ).rejects.toThrow();
  });
});

describe("pooled data comes only from real classes", () => {
  it("unknown wrong answers from test and sandbox classes never reach unknownErrors (practise and proof)", async () => {
    const { store, svc } = await fresh();
    const test = await classOfKind(store, "test");
    const sandbox = await classOfKind(store, "sandbox", "2026-10-21T09:00:00.000Z");
    for (const [i, classId] of [test, sandbox].entries()) {
      const student = await svc.createStudent(classId, `8B-${i + 1}`);
      await svc.teacherUnlock(student.id, SKILL);
      const item = await svc.servePracticeItem(student.id, SKILL);
      if (!item.ok) throw new Error(item.reason);
      expect(await svc.submitPracticeAnswer(item.itemId, "1000")).toMatchObject({ ok: true, correct: false, mistakeId: "unknown" });
      await teachPerfectly(svc, store, student.id);
      const proof = await svc.startProof(student.id, SKILL);
      if (!proof.ok) throw new Error(proof.reason);
      for (const p of proof.items) await svc.submitProofAnswer(p.itemId, "1000");
    }
    expect(await store.listUnknownErrors(SKILL)).toEqual([]);

    // the same answer in a real class is logged for the Miner
    const real = await classOfKind(store, "real");
    const child = await svc.createStudent(real, "8B-9");
    await svc.teacherUnlock(child.id, SKILL);
    const item = await svc.servePracticeItem(child.id, SKILL);
    if (!item.ok) throw new Error(item.reason);
    await svc.submitPracticeAnswer(item.itemId, "1000");
    expect((await store.listUnknownErrors(SKILL)).map((u) => u.wrongAnswer)).toEqual(["1000"]);
  });

  it("the pilot CSV of a test or tour class says it is not counted for impact", async () => {
    const { store, svc } = await fresh();
    const note = async (classId: string) => (await svc.exportPilotCsv(classId)).trim().split("\n").slice(1).map((r) => r.split(",").at(-1));
    for (const [kind, expected] of [
      ["test", "test class: not counted for impact"],
      ["sandbox", "tour class: not counted for impact"],
    ] as const) {
      const classId = await classOfKind(store, kind, kind === "sandbox" ? "2026-10-21T09:00:00.000Z" : null);
      await busyChild(svc, store, classId, `8B-${kind === "test" ? 1 : 2}`);
      expect(await note(classId)).toEqual([expected]);
    }
    const real = await classOfKind(store, "real");
    await busyChild(svc, store, real, "8B-3");
    expect(await note(real)).toEqual(["small sample"]);
  });
});

/** Rows anywhere that point at a student or class that no longer exists. */
async function orphans(url: string) {
  const sql = [
    "SELECT COUNT(*) AS n FROM students WHERE classId NOT IN (SELECT id FROM classes)",
    "SELECT COUNT(*) AS n FROM items WHERE studentId NOT IN (SELECT id FROM students)",
    "SELECT COUNT(*) AS n FROM attempts WHERE studentId NOT IN (SELECT id FROM students) OR itemId NOT IN (SELECT id FROM items)",
    "SELECT COUNT(*) AS n FROM teachTraces WHERE studentId NOT IN (SELECT id FROM students) OR itemId NOT IN (SELECT id FROM items)",
    "SELECT COUNT(*) AS n FROM proofRuns WHERE studentId NOT IN (SELECT id FROM students)",
    "SELECT COUNT(*) AS n FROM mastery WHERE studentId NOT IN (SELECT id FROM students)",
    "SELECT COUNT(*) AS n FROM events WHERE studentId IS NOT NULL AND studentId NOT IN (SELECT id FROM students)",
    "SELECT COUNT(*) AS n FROM worksheets WHERE classId NOT IN (SELECT id FROM classes)",
    "SELECT COUNT(*) AS n FROM rechecks WHERE studentId NOT IN (SELECT id FROM students)",
    "SELECT COUNT(*) AS n FROM readyChecks WHERE studentId NOT IN (SELECT id FROM students)",
  ];
  const db = createClient({ url });
  try {
    return await Promise.all(sql.map(async (q) => Number((await db.execute(q)).rows[0].n)));
  } finally {
    db.close();
  }
}

describe("deleteClassCascade", () => {
  it("deletes the class and every row of its students in one go, logs one class_deleted event with counts only, and leaves no orphans", async () => {
    const { store, svc, url } = await fresh();
    const gone = await classOfKind(store, "sandbox", "2026-10-21T09:00:00.000Z");
    const kept = await classOfKind(store, "real");
    const a = await busyChild(svc, store, gone, "8B-1");
    await busyChild(svc, store, gone, "8B-2");
    expect(await svc.createWorksheet(gone, SKILL, 4)).toMatchObject({ ok: true }); // a paper worksheet goes too
    const b = await busyChild(svc, store, kept, "8B-1");
    const keptBefore = await store.exportCounts(kept);
    const studentEventsBefore = (await store.listEvents()).filter((e) => e.studentId === b.id).length;

    const counts = await store.deleteClassCascade(gone, "2026-10-20T10:00:00.000Z");
    expect(counts).toMatchObject({ students: 2, mastery: 2, proofRuns: 2, worksheets: 1 });
    expect(counts!.items).toBeGreaterThan(0);
    expect(counts!.attempts).toBeGreaterThan(0);
    expect(counts!.teachTraces).toBe(6);
    expect(counts!.events).toBeGreaterThan(0);

    expect(await store.getClass(gone)).toBeUndefined();
    expect(await store.getStudent(a.id)).toBeUndefined();
    expect(await store.listMastery({ studentId: a.id })).toEqual([]);
    expect(await orphans(url)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    // the other class is untouched
    expect(await store.getClass(kept)).toBeDefined();
    expect(await store.exportCounts(kept)).toEqual(keptBefore);
    expect((await store.listEvents()).filter((e) => e.studentId === b.id).length).toBe(studentEventsBefore);

    const deleted = (await store.listEvents()).filter((e) => e.type === "class_deleted");
    expect(deleted).toHaveLength(1);
    const payload = JSON.parse(deleted[0].payloadJson);
    expect(deleted[0].studentId).toBeNull();
    expect(payload).toEqual({ kind: "sandbox", ...counts });
    expect(JSON.stringify(payload)).not.toMatch(/8B-|K\d+-/); // no student or class codes

    expect(await store.deleteClassCascade(gone, "2026-10-20T10:00:00.000Z")).toBeNull(); // already gone
  });
});

describe("sandbox clean-up", () => {
  it("deletes expired sandbox classes, at most once an hour; never a real or test class, never an unexpired sandbox", async () => {
    const { store, svc, clock, url } = await fresh();
    const past = new Date(clock.t - 3600_000).toISOString();
    const future = new Date(clock.t + 23 * 3600_000).toISOString();
    const expired = await classOfKind(store, "sandbox", past);
    const live = await classOfKind(store, "sandbox", future);
    const real = await classOfKind(store, "real", past); // an expiry on a real class means nothing
    const test = await classOfKind(store, "test", past);
    await busyChild(svc, store, expired, "8B-1");
    await busyChild(svc, store, real, "8B-1");

    expect(await svc.cleanUpSandboxes()).toEqual({ ran: true, deleted: 1 });
    expect(await store.getClass(expired)).toBeUndefined();
    for (const id of [live, real, test]) expect(await store.getClass(id)).toBeDefined();
    expect(await orphans(url)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    // within the hour: nothing runs, even though another sandbox has expired
    const late = await classOfKind(store, "sandbox", past);
    clock.advanceMinutes(59);
    expect(await svc.cleanUpSandboxes()).toEqual({ ran: false, deleted: 0 });
    expect(await store.getClass(late)).toBeDefined();

    // an hour later it runs again; the 24-hour sandbox is still there until it expires
    clock.advanceMinutes(2);
    expect(await svc.cleanUpSandboxes()).toEqual({ ran: true, deleted: 1 });
    expect(await store.getClass(late)).toBeUndefined();
    expect(await store.getClass(live)).toBeDefined();
    clock.advanceHours(23);
    expect(await svc.cleanUpSandboxes()).toEqual({ ran: true, deleted: 1 });
    expect(await store.getClass(live)).toBeUndefined();
    for (const id of [real, test]) expect(await store.getClass(id)).toBeDefined();
  });
});
