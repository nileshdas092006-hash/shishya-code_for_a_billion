import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { toString } from "../../core/fraction";
import { createRng } from "../../core/rng";
import { linearBothSides } from "../../core/skills/linear-both-sides";
import { createServices } from "../services";
import { openStore } from "../store";
import { answerProof, SKILL, setup, teachPerfectly } from "./helpers";

let ctx: ReturnType<typeof setup>;
afterEach(() => ctx?.done());

function toKey1(studentId = ctx.student.id) {
  ctx.svc.teacherUnlock(studentId, SKILL);
  teachPerfectly(ctx.svc, ctx.store, studentId);
}

/** Answers a practice item with the answer a given mistake produces (or a given text). */
function practiseWith(studentId: string, mistakeId: string | null, text?: string) {
  const served = ctx.svc.servePracticeItem(studentId, SKILL);
  if (!served.ok) throw new Error(served.reason);
  const item = ctx.store.getItem(served.itemId)!;
  const inst = linearBothSides.generate(createRng(item.seed));
  const m = linearBothSides.mistakes.find((x) => x.id === mistakeId);
  const answer = text ?? (m ? toString(m.apply(inst).answer) : item.answer);
  return ctx.svc.submitPracticeAnswer(served.itemId, answer);
}

describe("practice", () => {
  it("diagnoses wrong answers with src/core, and never sends the answer", () => {
    ctx = setup();
    ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const served = ctx.svc.servePracticeItem(ctx.student.id, SKILL);
    expect(JSON.stringify(served)).not.toContain('"answer"');
    expect(practiseWith(ctx.student.id, "kept-x-sign")).toMatchObject({ ok: true, correct: false, mistakeId: "kept-x-sign" });
    expect(practiseWith(ctx.student.id, null)).toMatchObject({ ok: true, correct: true, mistakeId: null });
  });

  it("an item takes one answer; a typo that cannot be read is not counted", () => {
    ctx = setup();
    ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const served = ctx.svc.servePracticeItem(ctx.student.id, SKILL);
    if (!served.ok) throw new Error(served.reason);
    expect(ctx.svc.submitPracticeAnswer(served.itemId, "abc")).toMatchObject({ ok: false });
    expect(ctx.svc.submitPracticeAnswer(served.itemId, "1")).toMatchObject({ ok: true });
    expect(ctx.svc.submitPracticeAnswer(served.itemId, "2")).toMatchObject({ ok: false });
  });

  it("counts unknown wrong answers per question in unknownErrors", () => {
    ctx = setup({ newSeed: () => 777 }); // everyone gets the same question
    const other = ctx.svc.createStudent(ctx.cls.id, "8B-18");
    for (const s of [ctx.student.id, other.id]) {
      ctx.svc.teacherUnlock(s, SKILL);
      expect(practiseWith(s, null, "1000")).toMatchObject({ correct: false, mistakeId: "unknown" });
    }
    const rows = ctx.store.listUnknownErrors(SKILL);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ wrongAnswer: "1000", count: 2 });
  });
});

describe("proof items are single-use, even when requests race", () => {
  it("the same proof item cannot be answered twice, even from two connections", () => {
    ctx = setup();
    toKey1();
    const run = ctx.svc.startProof(ctx.student.id, SKILL);
    if (!run.ok) throw new Error(run.reason);
    const store2 = openStore(ctx.file);
    const svc2 = createServices(store2, { now: ctx.clock.now });
    const id = run.items[0].itemId;
    const answer = ctx.store.getItem(id)!.answer;
    const results = [ctx.svc.submitProofAnswer(id, answer), svc2.submitProofAnswer(id, answer)];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(ctx.store.listAttemptsForItem(id)).toHaveLength(1);
    store2.close();
  });

  it("the database refuses a second proof item with the same question (unique index), across connections", () => {
    ctx = setup();
    const other = openStore(ctx.file);
    const row = {
      studentId: ctx.student.id,
      skillId: SKILL,
      version: "1.0.0",
      seed: 4242,
      kind: "proof" as const,
      format: "solve" as const,
      runId: "r1",
      mistakeId: null,
      paramsJson: "{}",
      answer: "5",
      servedAt: ctx.clock.now().toISOString(),
    };
    expect(ctx.store.insertItem({ ...row, id: "p1" })).toBe(true);
    expect(other.insertItem({ ...row, id: "p2" })).toBe(false);
    other.close();
  });

  it("two simultaneous startProof requests give one run", async () => {
    ctx = setup();
    toKey1();
    const store2 = openStore(ctx.file);
    const svc2 = createServices(store2, { now: ctx.clock.now });
    const [a, b] = await Promise.all([
      Promise.resolve().then(() => ctx.svc.startProof(ctx.student.id, SKILL)),
      Promise.resolve().then(() => svc2.startProof(ctx.student.id, SKILL)),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    store2.close();
  });

  it("a proof question already used by one child is never served to another", () => {
    // Teaching uses fresh seeds; then every proof question comes from a pool of only 4 seeds.
    let next = 1;
    let pool: number[] | null = null;
    ctx = setup({ newSeed: () => (pool ? pool[next++ % pool.length] : next++) });
    const other = ctx.svc.createStudent(ctx.cls.id, "8B-18");
    toKey1();
    toKey1(other.id);
    pool = [1001, 1002, 1003, 1004];
    next = 0;
    expect(ctx.svc.startProof(ctx.student.id, SKILL).ok).toBe(true); // uses 1001-1003 (solve) + 1004 (apply)
    const second = ctx.svc.startProof(other.id, SKILL);
    expect(second.ok).toBe(false);
    expect(ctx.store.getOpenProofRun(other.id, SKILL)).toBeUndefined(); // rolled back cleanly
  });
});

describe("stuck board", () => {
  it("groups students by their most frequent mistake in the last 7 days", () => {
    ctx = setup();
    const s = Object.fromEntries(
      ["8B-01", "8B-02", "8B-03", "8B-04", "8B-05"].map((code) => [code, ctx.svc.createStudent(ctx.cls.id, code).id]),
    );
    const outsider = ctx.svc.createStudent(ctx.svc.createClass("KV9A", 9).id, "9A-01").id;
    for (const id of [...Object.values(s), outsider, ctx.student.id]) ctx.svc.teacherUnlock(id, SKILL);

    practiseWith(s["8B-04"], "forgot-to-divide"); // 8 days ago: too old to count
    ctx.clock.advanceHours(8 * 24);
    practiseWith(s["8B-01"], "kept-x-sign");
    practiseWith(s["8B-01"], "kept-x-sign");
    practiseWith(s["8B-01"], "dropped-constant");
    practiseWith(s["8B-02"], "kept-x-sign");
    practiseWith(s["8B-03"], "kept-const-sign");
    practiseWith(s["8B-05"], null, "1000");
    practiseWith(ctx.student.id, null); // correct answers never appear
    practiseWith(outsider, "kept-x-sign"); // another class

    const board = ctx.svc.getStuckBoard(ctx.cls.id);
    expect(board.map((g) => [g.mistakeId, g.count, g.studentCodes])).toEqual([
      ["kept-x-sign", 2, ["8B-01", "8B-02"]],
      ["kept-const-sign", 1, ["8B-03"]],
      ["unknown", 1, ["8B-05"]],
    ]);
    expect(board[0].label.length).toBeGreaterThan(0);
  });
});

describe("pilot export and privacy", () => {
  it("the CSV has anonymous counts only, with no student codes or ids", () => {
    ctx = setup({ cooldownHours: 0 });
    const other = ctx.svc.createStudent(ctx.cls.id, "8B-18");
    toKey1();
    ctx.svc.teacherUnlock(other.id, SKILL);
    practiseWith(other.id, "kept-x-sign");
    const run = ctx.svc.startProof(ctx.student.id, SKILL);
    if (!run.ok) throw new Error(run.reason);
    answerProof(ctx.svc, ctx.store, run.items.map((i) => i.itemId));

    const csv = ctx.svc.exportPilotCsv(ctx.cls.id);
    for (const secret of ["8B-17", "8B-18", ctx.student.id, other.id, "KV8B"]) expect(csv).not.toContain(secret);
    const [header, row] = csv.trim().split("\n").map((l) => l.split(","));
    const rec = Object.fromEntries(header.map((h, i) => [h, row[i]]));
    expect(rec).toMatchObject({
      grade: "8",
      skillId: SKILL,
      students: "2",
      practiceAnswers: "1",
      practiceCorrect: "0",
      proofRuns: "1",
      proofsPassed: "1",
      studentsMastered: "1",
      note: "small sample",
    });
  });

  it("no table has a name column, and AI is allowed only from Class 8", () => {
    ctx = setup();
    const cols = ctx.store.listColumns().map((c) => c.column.toLowerCase());
    expect(cols.filter((c) => c.includes("name"))).toEqual([]);
    expect(ctx.svc.createClass("KV7A", 7).aiAllowed).toBe(false);
    expect(ctx.cls.aiAllowed).toBe(true);
  });

  it("rejects a student code that does not look like a code", () => {
    ctx = setup();
    expect(() => ctx.svc.createStudent(ctx.cls.id, "Rahul Sharma")).toThrow();
  });

  it("logs an event for every action", () => {
    ctx = setup({ cooldownHours: 0 });
    toKey1();
    practiseWith(ctx.student.id, "kept-x-sign");
    const run = ctx.svc.startProof(ctx.student.id, SKILL);
    if (!run.ok) throw new Error(run.reason);
    answerProof(ctx.svc, ctx.store, run.items.map((i) => i.itemId));
    ctx.svc.getStuckBoard(ctx.cls.id);
    ctx.svc.exportPilotCsv(ctx.cls.id);
    const types = new Set(ctx.store.listEvents().map((e) => e.type));
    for (const t of [
      "teacher_unlock",
      "teach_started",
      "teach_step",
      "practice_served",
      "practice_answered",
      "proof_started",
      "proof_answered",
      "proof_finished",
      "mastery_changed",
      "stuck_board_viewed",
      "pilot_export",
    ]) {
      expect(types, t).toContain(t);
    }
  });
});

describe("only src/server/mastery.ts may write mastery", () => {
  const SRC = join(__dirname, "..", "..");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return f === "__tests__" ? [] : files(p);
      return /\.(ts|tsx)$/.test(f) ? [p] : [];
    });
  const rel = (p: string) => relative(SRC, p).replace(/\\/g, "/");

  it("SQL that writes the mastery table appears only in store.ts", () => {
    const writers = files(SRC).filter((p) =>
      /\b(insert\s+(or\s+\w+\s+)?into|update|delete\s+from|replace\s+into)\s+mastery\b/i.test(readFileSync(p, "utf8")),
    );
    expect(writers.map(rel)).toEqual(["server/store.ts"]);
  });

  it("the store's writeMastery() is called only from mastery.ts", () => {
    const callers = files(SRC).filter((p) => /\bwriteMastery\s*\(/.test(readFileSync(p, "utf8")));
    expect(callers.map(rel).sort()).toEqual(["server/mastery.ts", "server/store.ts"]);
  });
});
