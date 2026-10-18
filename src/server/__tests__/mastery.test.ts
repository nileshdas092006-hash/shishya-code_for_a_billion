import { afterEach, describe, expect, it } from "vitest";
import { linearBothSides } from "../../core/skills/linear-both-sides";
import { generateApply } from "../../core/skills/linear-both-sides-apply";
import { evaluateTeach, proofCooldownHours } from "../mastery";
import { createServices } from "../services";
import { defaultRegistry, type Registry } from "../skills";
import { answerProof, correctFix, SKILL, setup, teachPerfectly } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
afterEach(() => ctx?.done());

const state = () => ctx.svc.getState(ctx.student.id, SKILL);
const evidence = async () => JSON.parse((await ctx.store.getMastery(ctx.student.id, SKILL))!.evidenceJson);

async function toKey1() {
  await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
  await teachPerfectly(ctx.svc, ctx.store, ctx.student.id);
  expect(await state()).toBe("KEY1");
}

async function startProof() {
  const run = await ctx.svc.startProof(ctx.student.id, SKILL);
  if (!run.ok) throw new Error(run.reason);
  return run;
}

describe("LOCKED → OPEN", () => {
  it("starts LOCKED when a prerequisite is not mastered, and refuses practice, teach and proof", async () => {
    ctx = await setup();
    expect(await state()).toBe("LOCKED");
    expect((await ctx.svc.servePracticeItem(ctx.student.id, SKILL)).ok).toBe(false);
    expect((await ctx.svc.startTeach(ctx.student.id, SKILL)).ok).toBe(false);
    expect((await ctx.svc.startProof(ctx.student.id, SKILL)).ok).toBe(false);
  });

  it("opens when the teacher unlocks it", async () => {
    ctx = await setup();
    expect(await ctx.svc.teacherUnlock(ctx.student.id, SKILL)).toBe("OPEN");
    expect((await evidence()).unlock).toEqual({ by: "teacher" });
    expect((await ctx.store.getMastery(ctx.student.id, SKILL))!.version).toBe("1.0.0");
  });

  it("opens when every prerequisite is MASTERED (and a skill with no prerequisites is open at once)", async () => {
    const registry: Registry = {
      ...defaultRegistry,
      "test.after": { spec: { ...linearBothSides, id: "test.after", prerequisites: [SKILL] }, generateApply },
      "test.root": { spec: { ...linearBothSides, id: "test.root", prerequisites: [] }, generateApply },
    };
    ctx = await setup({ registry, cooldownHours: 0 });
    expect(await ctx.svc.getState(ctx.student.id, "test.root")).toBe("OPEN");
    expect(await ctx.svc.getState(ctx.student.id, "test.after")).toBe("LOCKED");
    await toKey1();
    await answerProof(ctx.svc, ctx.store, (await startProof()).items.map((i) => i.itemId));
    expect(await state()).toBe("MASTERED");
    expect(await ctx.svc.getState(ctx.student.id, "test.after")).toBe("OPEN");
  });
});

describe("OPEN → KEY1 (teach rule: 3 traces, ≥2 mistakes, each fixed within 2 tries)", () => {
  it("OPEN cannot start a proof", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    expect(await ctx.svc.startProof(ctx.student.id, SKILL)).toMatchObject({ ok: false });
  });

  it("a teach session covers 3 traces and at least 2 different mistakes", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const s = await ctx.svc.startTeach(ctx.student.id, SKILL);
    if (!s.ok) throw new Error(s.reason);
    expect(s.traces).toHaveLength(3);
    const ids = [];
    for (const t of s.traces) ids.push((await ctx.store.getItem(t.itemId))!.mistakeId);
    expect(new Set(ids).size).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(s)).not.toContain('"answer"');
  });

  it("all 3 fixed on the first try → KEY1, with evidence ids and the version", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const { session, last } = await teachPerfectly(ctx.svc, ctx.store, ctx.student.id);
    expect(last).toMatchObject({ ok: true, state: "KEY1" });
    const ev = await evidence();
    expect(ev.key1.sessionId).toBe(session.sessionId);
    expect(ev.key1.traceIds).toHaveLength(3);
    expect(ev.key1.version).toBe("1.0.0");
  });

  it("a trace fixed on the second try still counts", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const s = await ctx.svc.startTeach(ctx.student.id, SKILL);
    if (!s.ok) throw new Error(s.reason);
    for (const [i, t] of s.traces.entries()) {
      const fix = await correctFix(ctx.store, t.itemId);
      if (i === 0) await ctx.svc.submitTeachStep(t.itemId, fix.line, fix.wrongText);
      await ctx.svc.submitTeachStep(t.itemId, fix.line, fix.text);
    }
    expect(await state()).toBe("KEY1");
  });

  it("a trace failed twice blocks KEY1, and a third try is refused", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const s = await ctx.svc.startTeach(ctx.student.id, SKILL);
    if (!s.ok) throw new Error(s.reason);
    for (const [i, t] of s.traces.entries()) {
      const fix = await correctFix(ctx.store, t.itemId);
      if (i === 0) {
        expect(await ctx.svc.submitTeachStep(t.itemId, fix.line, fix.wrongText)).toMatchObject({ ok: true, triesLeft: 1 });
        expect(await ctx.svc.submitTeachStep(t.itemId, fix.line, "x = 0")).toMatchObject({ ok: true, triesLeft: 0 });
        expect(await ctx.svc.submitTeachStep(t.itemId, fix.line, fix.text)).toMatchObject({ ok: false });
      } else await ctx.svc.submitTeachStep(t.itemId, fix.line, fix.text);
    }
    expect(await state()).toBe("OPEN");
    await teachPerfectly(ctx.svc, ctx.store, ctx.student.id); // a new session can still earn KEY1
    expect(await state()).toBe("KEY1");
  });

  it("the right fix on the wrong line does not count", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const s = await ctx.svc.startTeach(ctx.student.id, SKILL);
    if (!s.ok) throw new Error(s.reason);
    for (const t of s.traces) {
      const fix = await correctFix(ctx.store, t.itemId);
      const wrongLine = fix.line === 2 ? 3 : 2;
      await ctx.svc.submitTeachStep(t.itemId, wrongLine, fix.text);
      await ctx.svc.submitTeachStep(t.itemId, wrongLine, fix.text);
    }
    expect(await state()).toBe("OPEN");
  });

  it("does not trust stored flags: a forged 'fixed' trace row is re-checked with src/core", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const s = await ctx.svc.startTeach(ctx.student.id, SKILL);
    if (!s.ok) throw new Error(s.reason);
    for (const [i, t] of s.traces.entries()) {
      const item = (await ctx.store.getItem(t.itemId))!;
      await ctx.store.insertTeachTrace({
        id: `forged-${i}`,
        studentId: ctx.student.id,
        itemId: t.itemId,
        mistakeId: item.mistakeId!,
        tryNumber: 1,
        tappedLine: (await correctFix(ctx.store, t.itemId)).line,
        typedLine: "x = 999",
        lineCorrect: true,
        fixAccepted: true,
        createdAt: ctx.clock.now().toISOString(),
      });
    }
    // the engine re-checks every try with src/core, so the forged rows must not give KEY1
    expect(await evaluateTeach(ctx.store, ctx.student.id, defaultRegistry[SKILL], ctx.clock.now())).toBe("OPEN");
    expect(await state()).toBe("OPEN");
  });
});

describe("KEY1 → MASTERED / NOT_YET (proof: 3 solve + 1 apply, single-use, AI off, ≤ 30 minutes)", () => {
  it("serves 3 solve items and 1 apply item with AI off, never sending answers", async () => {
    ctx = await setup();
    await toKey1();
    const run = await startProof();
    expect(run.aiOff).toBe(true);
    expect(run.items.map((i) => i.format).sort()).toEqual(["apply", "solve", "solve", "solve"]);
    expect(JSON.stringify(run)).not.toContain('"answer"');
    expect((await ctx.store.getProofRun(run.runId))!.aiOff).toBe(true);
  });

  it("a fully correct proof → MASTERED, with evidence ids and the version", async () => {
    ctx = await setup();
    await toKey1();
    const run = await startProof();
    const last = await answerProof(ctx.svc, ctx.store, run.items.map((i) => i.itemId));
    expect(last).toMatchObject({ ok: true, finished: true, passed: true, state: "MASTERED" });
    const ev = await evidence();
    expect(ev.proof.runId).toBe(run.runId);
    expect(ev.proof.itemIds).toHaveLength(4);
    expect(ev.proof.version).toBe("1.0.0");
    expect(ev.key1.traceIds).toHaveLength(3);
    expect((await ctx.svc.startProof(ctx.student.id, SKILL)).ok).toBe(false); // already mastered
  });

  it("one wrong answer → NOT_YET, KEY1 kept, cooldown respected, then a pass → MASTERED", async () => {
    ctx = await setup({ cooldownHours: 24 });
    await toKey1();
    const last = await answerProof(ctx.svc, ctx.store, (await startProof()).items.map((i) => i.itemId), 2);
    expect(last).toMatchObject({ finished: true, passed: false, state: "NOT_YET" });
    expect((await evidence()).key1.traceIds).toHaveLength(3);

    ctx.clock.advanceHours(23);
    expect(await ctx.svc.startProof(ctx.student.id, SKILL)).toMatchObject({ ok: false, retryAt: expect.any(String) });
    await teachPerfectly(ctx.svc, ctx.store, ctx.student.id);
    expect(await state()).toBe("NOT_YET"); // more teaching does not change NOT_YET

    ctx.clock.advanceHours(1);
    await answerProof(ctx.svc, ctx.store, (await startProof()).items.map((i) => i.itemId));
    expect(await state()).toBe("MASTERED");
  });

  it("PROOF_COOLDOWN_HOURS = 0 allows an immediate retry (demo mode)", async () => {
    ctx = await setup({ cooldownHours: 0 });
    await toKey1();
    await answerProof(ctx.svc, ctx.store, (await startProof()).items.map((i) => i.itemId), 0);
    expect(await state()).toBe("NOT_YET");
    expect((await ctx.svc.startProof(ctx.student.id, SKILL)).ok).toBe(true);
  });

  it("a proof finished after 30 minutes fails, even if every answer is right", async () => {
    ctx = await setup();
    await toKey1();
    const ids = (await startProof()).items.map((i) => i.itemId);
    await answerProof(ctx.svc, ctx.store, ids.slice(0, 3));
    ctx.clock.advanceMinutes(31);
    const last = await ctx.svc.submitProofAnswer(ids[3], (await ctx.store.getItem(ids[3]))!.answer);
    expect(last).toMatchObject({ finished: true, passed: false, state: "NOT_YET" });
  });

  it("an abandoned proof is closed as failed when the next one is requested", async () => {
    ctx = await setup({ cooldownHours: 0 });
    await toKey1();
    const first = await startProof();
    expect(await ctx.svc.startProof(ctx.student.id, SKILL)).toMatchObject({ ok: false }); // still running
    ctx.clock.advanceMinutes(31);
    const second = await startProof();
    expect(await ctx.store.getProofRun(first.runId)).toMatchObject({ passed: false });
    expect(await state()).toBe("NOT_YET");
    expect(second.runId).not.toBe(first.runId);
  });

  it("does not trust stored flags: a forged 'correct' proof attempt is re-checked with src/core", async () => {
    ctx = await setup();
    await toKey1();
    const ids = (await startProof()).items.map((i) => i.itemId);
    await ctx.store.insertAttempt({
      id: "forged",
      studentId: ctx.student.id,
      itemId: ids[0],
      answer: "999",
      correct: true,
      mistakeId: null,
      createdAt: ctx.clock.now().toISOString(),
    });
    await ctx.store.markItemAnswered(ids[0], ctx.clock.now().toISOString());
    const last = await answerProof(ctx.svc, ctx.store, ids.slice(1));
    expect(last).toMatchObject({ finished: true, passed: false, state: "NOT_YET" });
  });

  it("a new skill version resets KEY1 / NOT_YET to OPEN (teach again on the new version)", async () => {
    ctx = await setup();
    await toKey1();
    const bumped: Registry = {
      [SKILL]: { ...defaultRegistry[SKILL], spec: { ...linearBothSides, version: "1.1.0" } },
    };
    const svc2 = createServices(ctx.store, { registry: bumped, now: ctx.clock.now, cooldownHours: 0 });
    expect(await svc2.getState(ctx.student.id, SKILL)).toBe("OPEN");
    expect((await svc2.startProof(ctx.student.id, SKILL)).ok).toBe(false);
  });
});

describe("PROOF_COOLDOWN_HOURS", () => {
  it.each([
    [undefined, 24],
    ["", 24],
    ["0", 0],
    ["6", 6],
    ["abc", 24],
    ["-3", 24],
  ])("%j → %i", (raw, hours) => {
    expect(proofCooldownHours({ PROOF_COOLDOWN_HOURS: raw })).toBe(hours);
  });
});
