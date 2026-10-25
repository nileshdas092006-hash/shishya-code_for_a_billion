import { createClient } from "@libsql/client";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { finalAnswer, scriptedModel, toolCall } from "../../agents/fake-model";
import run from "../../agents/__fixtures__/miner-run-2026-10-19.json";
import { parseAnswer } from "../../core/answer";
import { childMessage } from "../../core/childMessages";
import { diagnose } from "../../core/diagnose";
import { frac, toString } from "../../core/fraction";
import type { MinedMistakeSpec } from "../../core/minedMistake";
import { createRng } from "../../core/rng";
import { linearBothSides } from "../../core/skills/linear-both-sides";
import { t } from "../../i18n";
import { attemptVerdict, RECORDED_MINER_RUN, runMinerRecorded } from "../agent-runs";
import { createServices } from "../services";
import { openStore } from "../store";
import { correctFix, SKILL, setup, tempDbUrl } from "./helpers";

// F6: children never see AI-written words; teachers see the evidence and the agent's work.

/** The AI's child message from the first real run: it tells the child to MAKE the mistake. */
const AI_WORDS = "Do the same operation on both sides: divide by the coefficient of x on the left side of the original equation.";
const DRAFT: MinedMistakeSpec = {
  id: "divided-by-a",
  label: "Divided by the x-coefficient from the question instead of the collected one",
  childLabel: AI_WORDS,
  stepType: "divide",
  firstWrongLine: 5,
  lines: { "5": "x = {(d - b) / a}" },
  answerFormula: "(d - b) / a",
};

let ctx: Awaited<ReturnType<typeof setup>>;
afterEach(() => ctx?.done());

/** Logs 6 unknown wrong answers that "divide by a" explains (5/2 for 4x − 3 = 2x + 7 given 3 times). */
async function logErrors() {
  const params: Record<string, number>[] = [{ a: 4, b: -3, c: 2, d: 7 }];
  for (let seed = 1; params.length < 6; seed++) {
    const inst = linearBothSides.generate(createRng(seed));
    const typed = parseAnswer(toString(frac(inst.params.d - inst.params.b, inst.params.a)));
    if (typed.ok && diagnose(linearBothSides, inst, typed.value) === "unknown") params.push(inst.params);
  }
  for (const [i, p] of params.entries()) {
    for (let k = 0; k < (i === 0 ? 3 : 1); k++) await ctx.store.recordUnknownError(SKILL, JSON.stringify(p), toString(frac(p.d - p.b, p.a)));
  }
}

const script = () =>
  scriptedModel([
    toolCall("get_unknown_errors", {}),
    toolCall("validate_mined_mistake", { mistake: { ...DRAFT, id: "divided-d-by-a", lines: { "5": "x = {d / a}" }, answerFormula: "d / a" } }),
    toolCall("validate_mined_mistake", { mistake: DRAFT }),
    toolCall("submit_draft", { mistake: DRAFT }),
  ]);

async function draftFromMiner() {
  await logErrors();
  const result = await runMinerRecorded({ store: ctx.store, model: script(), skillId: SKILL, now: ctx.clock.now });
  expect(result.status).toBe("draft_saved");
  return result;
}

/** Answers practice questions with "divide by a" until the server has named the mistake (the 2nd question). */
async function answerUntilNamed(svc = ctx.svc) {
  const replies = [];
  for (;;) {
    const served = await svc.servePracticeItem(ctx.student.id, SKILL);
    if (!served.ok) throw new Error(served.reason);
    replies.push(served);
    const item = (await ctx.store.getItem(served.itemId))!;
    const p = JSON.parse(item.paramsJson);
    const wrong = frac(p.d - p.b, p.a);
    if (diagnose(linearBothSides, linearBothSides.generate(createRng(item.seed)), wrong) !== "unknown") {
      replies.push(await svc.submitPracticeAnswer(served.itemId, "1000"));
      continue;
    }
    const r = await svc.submitPracticeAnswer(served.itemId, toString(wrong));
    replies.push(r);
    if (r.ok && r.mistakeId === "divided-by-a") return { named: r, replies };
  }
}

describe("children never see AI-written words", () => {
  it("a mined mistake approved without edits shows the child the fixed message for its step type", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const { draftId } = await draftFromMiner();
    expect(await ctx.svc.decideMinedMistake(ctx.cls.id, draftId!, "approved")).toEqual({ ok: true });
    expect((await ctx.store.getMinedMistake(draftId!))!.childLabelSource).toBe("ai");
    const { named } = await answerUntilNamed();
    expect(named).toMatchObject({
      feedback: childMessage("divide", 5),
      feedbackKey: "child.step.divide",
      feedbackParams: { line: 5, prev: 4 },
    });
  });

  it("leaving the child box as the fixed message is not an edit; changing it shows the teacher's own words", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const { draftId } = await draftFromMiner();
    const mine = "You divided by the number in front of x in the question. Divide both sides by the number in front of x in line 4.";
    expect(await ctx.svc.decideMinedMistake(ctx.cls.id, draftId!, "approved", { childLabel: mine })).toEqual({ ok: true });
    expect((await ctx.store.getMinedMistake(draftId!))!.childLabelSource).toBe("teacher");
    const { named } = await answerUntilNamed();
    expect(named).toMatchObject({ feedback: mine });
    expect(named).not.toHaveProperty("feedbackKey");
  });

  it("the unchanged fixed message counts as no edit (the child sees the template, the AI's words stay unused)", async () => {
    ctx = await setup();
    const { draftId } = await draftFromMiner();
    const edits = { label: DRAFT.label, childLabel: ` ${childMessage("divide", 5)} ` };
    expect(await ctx.svc.decideMinedMistake(ctx.cls.id, draftId!, "approved", edits)).toEqual({ ok: true });
    expect((await ctx.store.getMinedMistake(draftId!))!.childLabelSource).toBe("ai");
  });

  it("no student path ever returns the AI's child label (practise, teach, proof, skill map, projector)", async () => {
    ctx = await setup({ cooldownHours: 0 });
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const { draftId } = await draftFromMiner();
    await ctx.svc.decideMinedMistake(ctx.cls.id, draftId!, "approved");
    const svc = createServices(ctx.store, { now: ctx.clock.now, cooldownHours: 0, random: () => 0.7 });

    const seen: unknown[] = [];
    seen.push(...(await answerUntilNamed(svc)).replies);
    const session = await svc.startTeach(ctx.student.id, SKILL);
    seen.push(session);
    if (!session.ok) throw new Error(session.reason);
    for (const tr of session.traces) {
      const item = (await ctx.store.getItem(tr.itemId))!;
      const fix =
        item.mistakeId === "divided-by-a"
          ? { line: 5, text: linearBothSides.solve(linearBothSides.generate(createRng(item.seed))).trace[4].text }
          : await correctFix(ctx.store, tr.itemId);
      seen.push(await svc.submitTeachStep(tr.itemId, 1, "x = 0")); // a wrong tap first
      seen.push(await svc.submitTeachStep(tr.itemId, fix.line, fix.text));
    }
    seen.push(await svc.getSkillMap(ctx.student.id));
    await svc.openProofWindow(ctx.cls.id);
    const proof = await svc.startProof(ctx.student.id, SKILL);
    seen.push(proof);
    if (proof.ok) for (const it of proof.items) seen.push(await svc.submitProofAnswer(it.itemId, "1000"));
    for (let i = 0; i < 8; i++) {
      const tr = await svc.projectorTrace(ctx.cls.id, SKILL);
      seen.push(tr, await svc.projectorCheck(ctx.cls.id, SKILL, tr.seed, tr.mistakeId, 5, "x = 1"));
    }

    const all = JSON.stringify(seen);
    expect(all).toContain("divided-by-a"); // the mined mistake really was used
    expect(all).not.toContain(AI_WORDS);
    expect(all).not.toContain("original equation");
  });

  it("student screens never read a mistake's childLabel themselves", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.tsx?$/.test(f) ? [join(dir, f)] : []));
    for (const file of files(join(__dirname, "..", "..", "app", "s"))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/childLabel/);
    }
  });

  it("older mined mistake rows get childLabelSource 'ai' (so children see the template)", async () => {
    const tmp = tempDbUrl();
    const old = createClient({ url: tmp.url });
    await old.executeMultiple(`
      CREATE TABLE minedMistakes (
        id TEXT PRIMARY KEY, skillId TEXT NOT NULL, source TEXT NOT NULL, testsJson TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('DRAFT_TESTED', 'APPROVED', 'REJECTED')), approver TEXT, createdAt TEXT NOT NULL);
      INSERT INTO minedMistakes VALUES ('m1', 's', '{}', '{}', 'APPROVED', 'teacher', '2026-10-18');
    `);
    old.close();
    const store = await openStore({ url: tmp.url });
    expect(await store.getMinedMistake("m1")).toMatchObject({ status: "APPROVED", childLabelSource: "ai" });
    store.close();
    const again = await openStore({ url: tmp.url }); // twice is safe
    expect(await again.getMinedMistake("m1")).toMatchObject({ childLabelSource: "ai" });
    again.close();
    tmp.cleanup();
  });
});

describe("the review card shows the evidence", () => {
  it("evidence rows for every logged wrong answer the draft explains, the 4 checks, and both child texts", async () => {
    ctx = await setup();
    await draftFromMiner();
    const { mined } = await ctx.svc.getClassBoard(ctx.cls.id);
    expect(mined).toHaveLength(1);
    const card = mined[0];
    expect(card.childText).toBe(childMessage("divide", 5));
    expect(card.aiChildLabel).toBe(AI_WORDS);
    expect(card.evidence).toHaveLength(6);
    expect(card.evidence[0]).toEqual({ question: "4x − 3 = 2x + 7", wrongAnswer: "5/2", predicted: "5/2", count: 3 });
    expect(card.evidence.slice(1).every((e) => e.count === 1)).toBe(true);
    expect(card.checks.map((c) => [c.id, c.ok])).toEqual([
      ["explains", true],
      ["neverRight", true],
      ["noDivideByZero", true],
      ["different", true],
    ]);
    expect(card.runId).toBeTruthy();
  });
});

describe("run history: agentRuns", () => {
  it("a fake-model run writes one row: proposals with their verdicts, provider and model, and no child data", async () => {
    ctx = await setup();
    const result = await draftFromMiner();
    const rows = (await ctx.store.listAgentRuns(10)).filter((r) => !r.recorded);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toMatchObject({
      id: result.runId,
      agent: "miner",
      skillId: SKILL,
      status: "draft_saved",
      turns: 4,
      provider: "fake",
      model: "fake",
      draftId: result.draftId,
      recorded: false,
      startedAt: ctx.clock.now().toISOString(),
    });
    const attempts = JSON.parse(row.attemptsJson);
    expect(attempts.map((a: { answerFormula: string; ok: boolean; reproduced: number }) => [a.answerFormula, a.ok, a.reproduced])).toEqual([
      ["d / a", false, 0],
      ["(d - b) / a", true, 6],
    ]);
    const text = JSON.stringify(row);
    for (const secret of [ctx.student.id, "8B-17", "KV8B", ctx.cls.id]) expect(text).not.toContain(secret);
  });

  it("runs that end early or fail are written too", async () => {
    ctx = await setup();
    const early = await runMinerRecorded({ store: ctx.store, model: script(), skillId: SKILL, now: ctx.clock.now });
    expect(early.status).toBe("not_enough_data");
    await logErrors();
    const broken = (async () => {
      throw new Error("All AI providers failed: groq: HTTP 429");
    }) as Parameters<typeof runMinerRecorded>[0]["model"];
    const failed = await runMinerRecorded({ store: ctx.store, model: broken, skillId: SKILL, now: ctx.clock.now });
    expect(failed.status).toBe("failed");
    const rows = (await ctx.store.listAgentRuns(10)).filter((r) => !r.recorded);
    expect(rows.map((r) => [r.status, r.provider, r.turns])).toEqual(
      expect.arrayContaining([
        ["not_enough_data", null, 0],
        ["failed", null, 0],
      ]),
    );
    expect(rows.find((r) => r.status === "failed")!.error).toMatch(/HTTP 429/);
  });

  it("the real 2026-10-19 run is imported once, marked recorded, from the local records only", async () => {
    ctx = await setup();
    const again = await openStore({ url: ctx.url }); // a second start-up does not add it again
    again.close();
    const recorded = (await ctx.store.listAgentRuns(10)).filter((r) => r.recorded);
    expect(recorded).toEqual([RECORDED_MINER_RUN]);
    expect(RECORDED_MINER_RUN).toMatchObject({
      agent: "miner",
      skillId: SKILL,
      status: "draft_saved",
      turns: run.calls.length,
      provider: run.provider,
      model: run.model,
      recorded: true,
      startedAt: run.calls[0].at,
      draftId: null,
    });
    expect(JSON.parse(RECORDED_MINER_RUN.attemptsJson)).toEqual([
      {
        id: run.proposal.id,
        answerFormula: run.proposal.answerFormula,
        ok: true,
        reproduced: run.validation.explained,
        errors: [],
        checked: run.validation.checkedQuestions,
        overlaps: run.validation.overlaps,
      },
    ]);
  });

  it("the teacher page lists the last 10 runs, newest first, each proposal with its verdict in plain words", async () => {
    ctx = await setup();
    await logErrors();
    for (let i = 0; i < 11; i++) {
      ctx.clock.advanceMinutes(1);
      await runMinerRecorded({ store: ctx.store, model: scriptedModel([toolCall("get_unknown_errors", {}), finalAnswer("no idea")]), skillId: SKILL, now: ctx.clock.now });
    }
    ctx.clock.advanceMinutes(1);
    await runMinerRecorded({ store: ctx.store, model: script(), skillId: SKILL, now: ctx.clock.now });
    const { runs } = await ctx.svc.listAgentRuns(ctx.cls.id);
    expect(runs).toHaveLength(10);
    expect(runs[0].status).toBe("draft_saved");
    expect(runs.map((r) => r.startedAt)).toEqual([...runs.map((r) => r.startedAt)].sort().reverse());
    const accepted = runs[0].attempts[1];
    expect(t(accepted.verdict.key, accepted.verdict.params)).toBe("Accepted: explains 6 real answers");
    expect(t(runs[0].attempts[0].verdict.key, runs[0].attempts[0].verdict.params)).toMatch(/^Rejected: /);
  });

  it("a tour class sees only the recorded run", async () => {
    ctx = await setup();
    await draftFromMiner();
    const tour = await ctx.svc.startTour();
    if (!tour.ok) throw new Error("tour");
    const { runs } = await ctx.svc.listAgentRuns(tour.classId);
    expect(runs.map((r) => r.id)).toEqual([RECORDED_MINER_RUN.id]);
  });
});

describe("verdicts in plain words", () => {
  const words = (a: Parameters<typeof attemptVerdict>[0]) => {
    const v = attemptVerdict(a);
    return t(v.key, v.params);
  };
  const base = { id: "x", answerFormula: "d / a", ok: false, reproduced: 5, errors: ["…"], checked: 1000, overlaps: {} };

  it.each([
    [{ ...base, ok: true, reproduced: 7, errors: [] }, "Accepted: explains 7 real answers"],
    [{ ...base, rightAnswerOn: 212 }, "Rejected: gives the right answer on 212 of 1,000 questions"],
    [{ ...base, divideByZeroOn: 4 }, "Rejected: divides by zero on 4 of 1,000 questions"],
    [{ ...base, reproduced: 2 }, "Rejected: explains only 2 real answers (it needs 3)"],
    [{ ...base, overlaps: { "forgot-to-divide": 150, "kept-x-sign": 3 } }, 'Rejected: gives the same answer as the known mistake "forgot-to-divide" on 150 of 1,000 questions'],
    [{ id: "x", answerFormula: "?", ok: false, reproduced: 0, errors: ['answerFormula: "?" is not allowed'] }, 'Rejected: answerFormula: "?" is not allowed'],
  ])("%j", (attempt, expected) => {
    expect(words(attempt)).toBe(expected);
  });
});
