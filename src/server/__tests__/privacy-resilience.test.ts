import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { healthResponse } from "../health";
import { createServices } from "../services";
import { openStore } from "../store";
import { answerProof, makeClock, setup, SKILL, teachPerfectly, tempDbUrl } from "./helpers";

// F7: the consent record gates student logins, a teacher can delete a class with everything in it, a forgotten
// PIN can be recovered, /api/health checks the database, each class sets its own proof cooldown, and the board
// shows children who have gone ahead to a later skill without mastering this one.

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
  return { store, svc, clock, url: tmp.url };
}

describe("the consent record gates student logins", () => {
  it("refuses every child of a new class with consent_needed until the teacher records consent, then lets them in", async () => {
    const { svc, store } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 2, pin: "123456" });
    expect(await svc.getClass(room.classId)).toMatchObject({ consentRecordedAt: null, consentSlips: null });
    expect(await svc.studentLogin(room.classCode, room.studentCodes[0])).toMatchObject({ ok: false, code: "consent_needed" });

    // refusals before consent are not counted as wrong codes (a class trying early is never locked out)
    for (let i = 0; i < 40; i++) await svc.studentLogin(room.classCode, room.studentCodes[1]);

    await expect(svc.recordConsent(room.classId, { allowed: false, slips: 3 })).rejects.toThrow();
    await expect(svc.recordConsent(room.classId, { allowed: true, slips: -1 })).rejects.toThrow();
    await svc.recordConsent(room.classId, { allowed: true, slips: 38 });
    const cls = await svc.getClass(room.classId);
    expect(cls?.consentSlips).toBe(38);
    expect(cls?.consentRecordedAt).toEqual(expect.any(String));
    expect(await svc.studentLogin(room.classCode, room.studentCodes[0])).toMatchObject({ ok: true });
    expect(await svc.studentLogin(room.classCode, room.studentCodes[1])).toMatchObject({ ok: true });
    const recorded = (await store.listEvents()).filter((e) => e.type === "consent_recorded");
    expect(recorded.map((e) => JSON.parse(e.payloadJson))).toEqual([{ classId: room.classId, slips: 38 }]);
  });

  it("wrong codes in a class without consent still get the same answer as any wrong code", async () => {
    const { svc } = await fresh();
    expect(await svc.studentLogin("NOPE-1", "8B-K7QM")).toMatchObject({ ok: false, code: "wrong_codes" });
  });

  it("Judge Tour classes are made already recorded, so the judge's child can log in", async () => {
    const { svc } = await fresh();
    const tour = await svc.startTour();
    if (!tour.ok) throw new Error(tour.reason);
    expect((await svc.getClass(tour.classId))?.consentRecordedAt).toEqual(expect.any(String));
    expect(await svc.studentLogin(tour.classCode, "8T-YOU")).toMatchObject({ ok: true, studentId: tour.studentId });
  });

  it("migration: classes that already exist get consent recorded at migration time, with one log line, so nothing live breaks", async () => {
    const tmp = tempDbUrl();
    cleanup = tmp.cleanup;
    const old = createClient({ url: tmp.url });
    await old.executeMultiple(`
      CREATE TABLE classes (
        id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
        section TEXT NOT NULL DEFAULT '', aiAllowed INTEGER NOT NULL CHECK (aiAllowed IN (0, 1)), teacherPinHash TEXT);
      INSERT INTO classes VALUES ('c1', '8B-OLD1', 8, 'B', 1, NULL);
      INSERT INTO classes VALUES ('c2', '8C-OLD2', 8, 'C', 1, NULL);
      CREATE TABLE students (id TEXT PRIMARY KEY, classId TEXT NOT NULL REFERENCES classes(id), code TEXT NOT NULL, UNIQUE (classId, code));
      INSERT INTO students VALUES ('s1', 'c1', '8B-17');
    `);
    old.close();

    const store = await openStore({ url: tmp.url });
    const c1 = await store.getClass("c1");
    expect(c1?.consentRecordedAt).toEqual(expect.any(String));
    expect(c1).toMatchObject({ consentSlips: null, proofCooldownHours: null });
    expect((await store.getClass("c2"))?.consentRecordedAt).toEqual(expect.any(String));
    const svc = createServices(store, { now: makeClock().now });
    expect(await svc.studentLogin("8B-OLD1", "8B-17")).toMatchObject({ ok: true, studentId: "s1" });
    const noted = (await store.listEvents()).filter((e) => e.type === "consent_recorded_by_migration");
    expect(noted).toHaveLength(1);
    expect(JSON.parse(noted[0].payloadJson)).toEqual({ classes: 2 });
    store.close();

    const again = await openStore({ url: tmp.url }); // running it twice is safe: no second note, times kept
    expect((await again.getClass("c1"))?.consentRecordedAt).toBe(c1?.consentRecordedAt);
    expect((await again.listEvents()).filter((e) => e.type === "consent_recorded_by_migration")).toHaveLength(1);
    again.close();
  });
});

/** Every row in every table that still mentions any of these ids (a student, item or class id). */
async function rowsMentioning(url: string, ids: string[]): Promise<string[]> {
  const db = createClient({ url });
  const tables = (await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).rows.map((r) => String(r.name));
  const found: string[] = [];
  for (const t of tables) {
    for (const row of (await db.execute(`SELECT * FROM ${t}`)).rows) {
      const text = JSON.stringify(row);
      if (ids.some((id) => text.includes(id))) found.push(`${t}: ${text}`);
    }
  }
  db.close();
  return found;
}

describe("deleting a class", () => {
  it("needs the typed class code; then no row of that class remains, and the other class is untouched", async () => {
    const { svc, store, url } = await fresh();
    const make = async (section: string) => {
      const room = await svc.createClassroom({ grade: 8, section, studentCount: 3, pin: "123456" });
      await svc.recordConsent(room.classId, { allowed: true, slips: 3 });
      await svc.openProofWindow(room.classId);
      const ids: string[] = [];
      for (const code of room.studentCodes) {
        const r = await svc.studentLogin(room.classCode, code);
        if (!r.ok) throw new Error(r.reason);
        ids.push(r.studentId);
      }
      await svc.teacherUnlockClass(room.classId, SKILL);
      const p = await svc.servePracticeItem(ids[0], SKILL);
      if (p.ok) await svc.submitPracticeAnswer(p.itemId, "1000");
      await teachPerfectly(svc, store, ids[1]);
      const proof = await svc.startProof(ids[1], SKILL);
      if (!proof.ok) throw new Error(proof.reason);
      await answerProof(svc, store, proof.items.map((i) => i.itemId));
      await svc.verifyTeacherPin(room.classCode, "000000"); // a class-level log line
      // a paper worksheet with one answer typed in (P1a): it goes with the class too
      const ws = await svc.createWorksheet(room.classId, SKILL, 2);
      if (!ws.ok) throw new Error(ws.reason);
      await svc.savePaperAnswers(room.classId, ws.worksheet.code, [{ studentCode: room.studentCodes[2], question: 1, text: "9999" }]);
      return { room, ids };
    };
    const gone = await make("B");
    const kept = await make("C");
    // a mistake this class's teacher approved stays in the library, but no longer names the class
    await store.insertMinedMistake({
      id: "m1", skillId: SKILL, source: "{}", testsJson: "{}", status: "APPROVED",
      approver: `teacher of class ${gone.room.classCode} (edited the labels)`, createdAt: "2026-10-20T09:00:00.000Z",
    });
    const keptBefore = await rowsMentioning(url, [kept.room.classId, ...kept.ids]);

    expect(await svc.deleteClass(gone.room.classId, "8C-WRONG")).toMatchObject({ ok: false, code: "confirm_mismatch" });
    expect(await svc.deleteClass(gone.room.classId, "")).toMatchObject({ ok: false, code: "confirm_mismatch" });
    expect(await svc.getClass(gone.room.classId)).toBeDefined();

    const done = await svc.deleteClass(gone.room.classId, ` ${gone.room.classCode.toLowerCase()} `);
    expect(done).toMatchObject({ ok: true, counts: { students: 3, proofRuns: 1 } });
    expect(await rowsMentioning(url, [gone.room.classId, ...gone.ids])).toEqual([]);
    expect(await rowsMentioning(url, [gone.room.classCode, ...gone.room.studentCodes])).toEqual([]);
    expect(await rowsMentioning(url, [kept.room.classId, ...kept.ids])).toEqual(keptBefore);
    expect(await store.getMinedMistake("m1")).toMatchObject({ status: "APPROVED", approver: "teacher of a deleted class" });
    expect(await svc.studentLogin(kept.room.classCode, kept.room.studentCodes[0])).toMatchObject({ ok: true });

    const logged = (await store.listEvents()).filter((e) => e.type === "class_deleted");
    expect(logged).toHaveLength(1);
    expect(Object.keys(JSON.parse(logged[0].payloadJson)).sort()).toEqual(
      ["attempts", "events", "items", "kind", "mastery", "proofRuns", "students", "teachTraces", "worksheets"].sort(),
    );
    expect(await svc.deleteClass(gone.room.classId, gone.room.classCode)).toMatchObject({ ok: false, code: "none" });
  });
});

describe("teacher PIN recovery", () => {
  it("gives a 10-character recovery code once; the right code gives a new PIN and a new recovery code", async () => {
    const { svc, store, url } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 1, pin: "123456" });
    expect(room.recoveryCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/);
    // only a hash is stored
    expect(await rowsMentioning(url, [room.recoveryCode])).toEqual([]);

    const out = await svc.recoverTeacherPin(room.classCode.toLowerCase(), ` ${room.recoveryCode.slice(0, 5)} ${room.recoveryCode.slice(5).toLowerCase()} `);
    if (!out.ok) throw new Error(out.reason);
    expect(out.classId).toBe(room.classId);
    expect(out.pin).toMatch(/^\d{6}$/);
    expect(out.recoveryCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/);
    expect(out.recoveryCode).not.toBe(room.recoveryCode);

    expect(await svc.verifyTeacherPin(room.classCode, out.pin)).toMatchObject({ ok: true });
    if (out.pin !== "123456") expect(await svc.verifyTeacherPin(room.classCode, "123456")).toMatchObject({ ok: false });
    // the old recovery code no longer works, the new one does
    expect(await svc.recoverTeacherPin(room.classCode, room.recoveryCode)).toMatchObject({ ok: false, code: "wrong_recovery" });
    expect(await svc.recoverTeacherPin(room.classCode, out.recoveryCode)).toMatchObject({ ok: true });
    const events = (await store.listEvents()).filter((e) => e.type === "pin_recovery");
    expect(events.every((e) => !e.payloadJson.includes(room.recoveryCode) && !e.payloadJson.includes(out.pin))).toBe(true);
  });

  it("wrong recovery codes are throttled in the database: after 5, even the right one waits 15 minutes", async () => {
    const { svc, store, clock } = await fresh();
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 1, pin: "123456" });
    for (let i = 0; i < 5; i++) {
      expect(await svc.recoverTeacherPin(room.classCode, "AAAAAAAAAA")).toMatchObject({ ok: false, code: "wrong_recovery" });
    }
    expect(await svc.recoverTeacherPin(room.classCode, room.recoveryCode)).toMatchObject({ ok: false, code: "locked_out" });
    // another server instance sees the same count
    const other = createServices(store, { now: clock.now });
    expect(await other.recoverTeacherPin(room.classCode, room.recoveryCode)).toMatchObject({ ok: false, code: "locked_out" });
    clock.advanceMinutes(16);
    expect(await svc.recoverTeacherPin(room.classCode, room.recoveryCode)).toMatchObject({ ok: true });
  });

  it("a class made before recovery codes says it has none", async () => {
    const { svc } = await fresh();
    const cls = await svc.createClass("KV8B", 8); // the older set-up path: no PIN, no recovery code
    expect(await svc.recoverTeacherPin(cls.code, "ABCDEFGHJK")).toMatchObject({ ok: false, code: "no_recovery" });
    expect(await svc.recoverTeacherPin("NOPE", "ABCDEFGHJK")).toMatchObject({ ok: false, code: "wrong_recovery" });
  });
});

describe("GET /api/health", () => {
  it("is ok after a trivial database read, with no secrets, counts or child data, and never cached", async () => {
    const { svc } = await fresh();
    const res = await healthResponse(async () => svc);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  it("answers 503 { ok: false } with no error details when the store fails", async () => {
    const { store, svc } = await fresh();
    store.close();
    const res = await healthResponse(async () => svc);
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.text()).toBe(JSON.stringify({ ok: false }));

    const noServices = await healthResponse(async () => {
      throw new Error("DATABASE_URL secret-value-here");
    });
    expect(noServices.status).toBe(503);
    expect(await noServices.text()).toBe(JSON.stringify({ ok: false }));
  });

  it("also runs the hourly sandbox clean-up", async () => {
    const { svc, clock } = await fresh();
    const tour = await svc.startTour(); // the first clean-up runs here
    if (!tour.ok) throw new Error(tour.reason);
    clock.advanceHours(25);
    expect((await healthResponse(async () => svc)).status).toBe(200);
    expect(await svc.getClass(tour.classId)).toBeUndefined();
  });
});

describe("proof cooldown per class", () => {
  async function failedProof(hours: 0 | 1 | 24 | null) {
    const t = await setup({ cooldownHours: 24 });
    cleanup = t.done;
    if (hours !== null) await t.svc.setProofCooldown(t.cls.id, hours);
    await t.svc.teacherUnlock(t.student.id, SKILL);
    await teachPerfectly(t.svc, t.store, t.student.id);
    const proof = await t.svc.startProof(t.student.id, SKILL);
    if (!proof.ok) throw new Error(proof.reason);
    const out = await answerProof(t.svc, t.store, proof.items.map((i) => i.itemId), 0);
    expect(out).toMatchObject({ finished: true, passed: false });
    return t;
  }

  it("a 1 h class refuses a retry at 59 minutes and allows it at 61", async () => {
    const t = await failedProof(1);
    t.clock.advanceMinutes(59);
    expect(await t.svc.proofStatus(t.student.id, SKILL)).toMatchObject({ canStart: false, code: "cooldown" });
    expect(await t.svc.startProof(t.student.id, SKILL)).toMatchObject({ ok: false, code: "cooldown" });
    t.clock.advanceMinutes(2);
    expect(await t.svc.proofStatus(t.student.id, SKILL)).toEqual({ canStart: true });
    expect(await t.svc.startProof(t.student.id, SKILL)).toMatchObject({ ok: true });
  });

  it("straight away (0) allows a retry at once; no class value means the server default", async () => {
    const zero = await failedProof(0);
    expect(await zero.svc.proofStatus(zero.student.id, SKILL)).toEqual({ canStart: true });
    zero.done();

    const unset = await failedProof(null);
    unset.clock.advanceHours(23);
    expect(await unset.svc.proofStatus(unset.student.id, SKILL)).toMatchObject({ canStart: false, code: "cooldown" });
  });

  it("only 0, 1 and 24 hours can be chosen", async () => {
    const t = await setup();
    cleanup = t.done;
    await expect(t.svc.setProofCooldown(t.cls.id, 5 as 1)).rejects.toThrow();
    await t.svc.setProofCooldown(t.cls.id, 24);
    expect((await t.svc.getClass(t.cls.id))?.proofCooldownHours).toBe(24);
  });
});

describe("gone ahead without mastery", () => {
  it("counts, per skill, the children who have not mastered it while a skill that needs it is open for them", async () => {
    const t = await setup();
    cleanup = t.done;
    const a = t.student; // like-terms opened by the teacher while integers is only OPEN
    const b = await t.svc.createStudent(t.cls.id, "8B-18"); // nothing opened: not counted anywhere
    const c = await t.svc.createStudent(t.cls.id, "8B-19"); // both-sides opened while two-step is LOCKED
    await t.svc.teacherUnlock(a.id, "alg.like-terms");
    await t.svc.teacherUnlock(c.id, SKILL);
    void b;
    const board = await t.svc.getClassBoard(t.cls.id);
    const goneAhead = Object.fromEntries(board.progress.map((p) => [p.skillId, p.goneAhead]));
    expect(goneAhead).toEqual({
      "alg.integers.ops": 1,
      "alg.like-terms": 0,
      "alg.linear.one-step": 0,
      "alg.linear.two-step": 1,
      [SKILL]: 0,
    });
  });
});
