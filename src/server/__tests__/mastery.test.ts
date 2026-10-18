import { afterEach, describe, expect, it } from "vitest";
import { linearBothSides } from "../../core/skills/linear-both-sides";
import { generateApply } from "../../core/skills/linear-both-sides-apply";
import { evaluateTeach, proofCooldownHours } from "../mastery";
import { createServices } from "../services";
import { defaultRegistry, type Registry } from "../skills";
import { answerProof, correctFix, SKILL, setup, teachPerfectly } from "./helpers";

let ctx: ReturnType<typeof setup>;
afterEach(() => ctx?.done());

const state = () => ctx.svc.getState(ctx.student.id, SKILL);
const evidence = () => JSON.parse(ctx.store.getMastery(ctx.student.id, SKILL)!.evidenceJson);

function toKey1() {
  ctx.svc.teacherUnlock(ctx.student.id, SKILL);
  teachPerfectly(ctx.svc, ctx.store, ctx.student.id);
  expect(state()).toBe("KEY1");
}

function startProof() {
  const run = ctx.svc.startProof(ctx.student.id, SKILL);
  if (!run.ok) throw new Error(run.reason);
  return run;
}

describe("LOCKED → OPEN", () => {
  it("starts LOCKED when a prerequisite is not mastered, and refuses practice, teach and proof", () => {
    ctx = setup();
    expect(state()).toBe("LOCKED");
    expect(ctx.svc.servePracticeItem(ctx.student.id, SKILL).ok).toBe(false);
    expect(ctx.svc.startTeach(ctx.student.id, SKILL).ok).toBe(false);
    expect(ctx.svc.startProof(ctx.student.id, SKILL).ok).toBe(false);
  });

  it("opens when the teacher unlocks it", () => {
    ctx = setup();
    expect(ctx.svc.teacherUnlock(ctx.student.id, SKILL)).toBe("OPEN");
    expect(evidence().unlock).toEqual({ by: "teacher" });
    expect(ctx.store.getMastery(ctx.student.id, SKILL)!.version).toBe("1.0.0");
  });

  it("opens when every prerequisite is MASTERED (and a skill with no prerequisites is open at once)", () => {
    const registry: Registry = {
      ...defaultRegistry,
      "test.after": { spec: { ...linearBothSides, id: "test.after", prerequisites: [SKILL] }, generateApply },
      "test.root": { spec: { ...linearBothSides, id: "test.root", prerequisites: [] }, generateApply },
    };
    ctx = setup({ registry, cooldownHours: 0 });
    expect(ctx.svc.getState(ctx.student.id, "test.root")).toBe("OPEN");
    expect(ctx.svc.getState(ctx.student.id, "test.after")).toBe("LOCKED");
    toKey1();
    answerProof(ctx.svc, ctx.store, startProof().items.map((i) => i.itemId));
    expect(state()).toBe("MASTERED");
    expect(ctx.svc.getState(ctx.student.id, "test.after")).toBe("OPEN");
  });
});

describe("OPEN → KEY1 (teach rule: 3 traces, ≥2 mistakes, each fixed within 2 tries)", () => {
  it("OPEN cannot start a proof", () => {
    ctx = setup();
    ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    expect(ctx.svc.startProof(ctx.student.id, SKILL)).toMatchObject({ ok: false });
  });

  it("a teach session covers 3 traces and at least 2 different mistakes", () => {
    ctx = setup();
    ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const s = ctx.svc.startTeach(ctx.student.id, SKILL);
    if (!s.ok) throw new Error(s.reason);
    expect(s.traces).toHaveLength(3);
    const ids = s.traces.map((t) => ctx.store.getItem(t.itemId)!.mistakeId);
    expect(new Set(ids).size).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(s)).not.toContain('"answer"');
  });

  it("all 3 fixed on the first try → KEY1, with evidence ids and the version", () => {
    ctx = setup();
    ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const { session, last } = teachPerfectly(ctx.svc, ctx.store, ctx.student.id);
    expect(last).toMatchObject({ ok: true, state: "KEY1" });
    const ev = evidence();
    expect(ev.key1.sessionId).toBe(session.sessionId);
    expect(ev.key1.traceIds).toHaveLength(3);
    expect(ev.key1.version).toBe("1.0.0");
  });

  it("a trace fixed on the second try still counts", () => {
    ctx = setup();
    ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const s = ctx.svc.startTeach(ctx.student.id, SKILL);
    if (!s.ok) throw new Error(s.reason);
    s.traces.forEach((t, i) => {
      const fix = correctFix(ctx.store, t.itemId);
      if (i === 0) ctx.svc.submitTeachStep(t.itemId, fix.line, fix.wrongText);
      ctx.svc.submitTeachStep(t.itemId, fix.line, fix.text);
    });
    expect(state()).toBe("KEY1");
  });

  it("a trace failed twice blocks KEY1, and a third try is refused", () => {
    ctx = setup();
    ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const s = ctx.svc.startTeach(ctx.student.id, SKILL);
    if (!s.ok) throw new Error(s.reason);
    s.traces.forEach((t, i) => {
      const fix = correctFix(ctx.store, t.itemId);
      if (i === 0) {
        expect(ctx.svc.submitTeachStep(t.itemId, fix.line, fix.wrongText)).toMatchObject({ ok: true, triesLeft: 1 });
        expect(ctx.svc.submitTeachStep(t.itemId, fix.line, "x = 0")).toMatchObject({ ok: true, triesLeft: 0 });
        expect(ctx.svc.submitTeachStep(t.itemId, fix.line, fix.text)).toMatchObject({ ok: false });
      } else ctx.svc.submitTeachStep(t.itemId, fix.line, fix.text);
    });
    expect(state()).toBe("OPEN");
    teachPerfectly(ctx.svc, ctx.store, ctx.student.id); // a new session can still earn KEY1
    expect(state()).toBe("KEY1");
  });

  it("the right fix on the wrong line does not count", () => {
    ctx = setup();
    ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const s = ctx.svc.startTeach(ctx.student.id, SKILL);
    if (!s.ok) throw new Error(s.reason);
    for (const t of s.traces) {
      const fix = correctFix(ctx.store, t.itemId);
      const wrongLine = fix.line === 2 ? 3 : 2;
      ctx.svc.submitTeachStep(t.itemId, wrongLine, fix.text);
      ctx.svc.submitTeachStep(t.itemId, wrongLine, fix.text);
    }
    expect(state()).toBe("OPEN");
  });

  it("does not trust stored flags: a forged 'fixed' trace row is re-checked with src/core", () => {
    ctx = setup();
    ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const s = ctx.svc.startTeach(ctx.student.id, SKILL);
    if (!s.ok) throw new Error(s.reason);
    s.traces.forEach((t, i) => {
      const item = ctx.store.getItem(t.itemId)!;
      ctx.store.insertTeachTrace({
        id: `forged-${i}`,
        studentId: ctx.student.id,
        itemId: t.itemId,
        mistakeId: item.mistakeId!,
        tryNumber: 1,
        tappedLine: correctFix(ctx.store, t.itemId).line,
        typedLine: "x = 999",
        lineCorrect: true,
        fixAccepted: true,
        createdAt: ctx.clock.now().toISOString(),
      });
    });
    // the engine re-checks every try with src/core, so the forged rows must not give KEY1
    expect(evaluateTeach(ctx.store, ctx.student.id, defaultRegistry[SKILL], ctx.clock.now())).toBe("OPEN");
    expect(state()).toBe("OPEN");
  });
});

describe("KEY1 → MASTERED / NOT_YET (proof: 3 solve + 1 apply, single-use, AI off, ≤ 30 minutes)", () => {
  it("serves 3 solve items and 1 apply item with AI off, never sending answers", () => {
    ctx = setup();
    toKey1();
    const run = startProof();
    expect(run.aiOff).toBe(true);
    expect(run.items.map((i) => i.format).sort()).toEqual(["apply", "solve", "solve", "solve"]);
    expect(JSON.stringify(run)).not.toContain('"answer"');
    expect(ctx.store.getProofRun(run.runId)!.aiOff).toBe(true);
  });

  it("a fully correct proof → MASTERED, with evidence ids and the version", () => {
    ctx = setup();
    toKey1();
    const run = startProof();
    const last = answerProof(ctx.svc, ctx.store, run.items.map((i) => i.itemId));
    expect(last).toMatchObject({ ok: true, finished: true, passed: true, state: "MASTERED" });
    const ev = evidence();
    expect(ev.proof.runId).toBe(run.runId);
    expect(ev.proof.itemIds).toHaveLength(4);
    expect(ev.proof.version).toBe("1.0.0");
    expect(ev.key1.traceIds).toHaveLength(3);
    expect(ctx.svc.startProof(ctx.student.id, SKILL).ok).toBe(false); // already mastered
  });

  it("one wrong answer → NOT_YET, KEY1 kept, cooldown respected, then a pass → MASTERED", () => {
    ctx = setup({ cooldownHours: 24 });
    toKey1();
    const last = answerProof(ctx.svc, ctx.store, startProof().items.map((i) => i.itemId), 2);
    expect(last).toMatchObject({ finished: true, passed: false, state: "NOT_YET" });
    expect(evidence().key1.traceIds).toHaveLength(3);

    ctx.clock.advanceHours(23);
    expect(ctx.svc.startProof(ctx.student.id, SKILL)).toMatchObject({ ok: false, retryAt: expect.any(String) });
    teachPerfectly(ctx.svc, ctx.store, ctx.student.id);
    expect(state()).toBe("NOT_YET"); // more teaching does not change NOT_YET

    ctx.clock.advanceHours(1);
    answerProof(ctx.svc, ctx.store, startProof().items.map((i) => i.itemId));
    expect(state()).toBe("MASTERED");
  });

  it("PROOF_COOLDOWN_HOURS = 0 allows an immediate retry (demo mode)", () => {
    ctx = setup({ cooldownHours: 0 });
    toKey1();
    answerProof(ctx.svc, ctx.store, startProof().items.map((i) => i.itemId), 0);
    expect(state()).toBe("NOT_YET");
    expect(ctx.svc.startProof(ctx.student.id, SKILL).ok).toBe(true);
  });

  it("a proof finished after 30 minutes fails, even if every answer is right", () => {
    ctx = setup();
    toKey1();
    const ids = startProof().items.map((i) => i.itemId);
    answerProof(ctx.svc, ctx.store, ids.slice(0, 3));
    ctx.clock.advanceMinutes(31);
    const last = ctx.svc.submitProofAnswer(ids[3], ctx.store.getItem(ids[3])!.answer);
    expect(last).toMatchObject({ finished: true, passed: false, state: "NOT_YET" });
  });

  it("an abandoned proof is closed as failed when the next one is requested", () => {
    ctx = setup({ cooldownHours: 0 });
    toKey1();
    const first = startProof();
    expect(ctx.svc.startProof(ctx.student.id, SKILL)).toMatchObject({ ok: false }); // still running
    ctx.clock.advanceMinutes(31);
    const second = startProof();
    expect(ctx.store.getProofRun(first.runId)).toMatchObject({ passed: false });
    expect(state()).toBe("NOT_YET");
    expect(second.runId).not.toBe(first.runId);
  });

  it("does not trust stored flags: a forged 'correct' proof attempt is re-checked with src/core", () => {
    ctx = setup();
    toKey1();
    const ids = startProof().items.map((i) => i.itemId);
    ctx.store.insertAttempt({
      id: "forged",
      studentId: ctx.student.id,
      itemId: ids[0],
      answer: "999",
      correct: true,
      mistakeId: null,
      createdAt: ctx.clock.now().toISOString(),
    });
    ctx.store.markItemAnswered(ids[0], ctx.clock.now().toISOString());
    const last = answerProof(ctx.svc, ctx.store, ids.slice(1));
    expect(last).toMatchObject({ finished: true, passed: false, state: "NOT_YET" });
  });

  it("a new skill version resets KEY1 / NOT_YET to OPEN (teach again on the new version)", () => {
    ctx = setup();
    toKey1();
    const bumped: Registry = {
      [SKILL]: { ...defaultRegistry[SKILL], spec: { ...linearBothSides, version: "1.1.0" } },
    };
    const svc2 = createServices(ctx.store, { registry: bumped, now: ctx.clock.now, cooldownHours: 0 });
    expect(svc2.getState(ctx.student.id, SKILL)).toBe("OPEN");
    expect(svc2.startProof(ctx.student.id, SKILL).ok).toBe(false);
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
