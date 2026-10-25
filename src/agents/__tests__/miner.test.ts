import { afterEach, describe, expect, it } from "vitest";
import { parseAnswer } from "../../core/answer";
import { diagnose } from "../../core/diagnose";
import { childMessage } from "../../core/childMessages";
import { frac, toString } from "../../core/fraction";
import type { MinedMistakeSpec, UnknownError } from "../../core/minedMistake";
import { createRng } from "../../core/rng";
import { linearBothSides } from "../../core/skills/linear-both-sides";
import { createMinerPorts } from "../../server/miner-ports";
import { createServices } from "../../server/services";
import { correctFix, SKILL, setup } from "../../server/__tests__/helpers";
import { finalAnswer, scriptedModel, toolCall } from "../fake-model";
import { groupUnknownErrors, MAX_ERROR_GROUPS, runMiner } from "../miner";

const DIVIDE_BY_A: MinedMistakeSpec = {
  id: "divided-by-a",
  label: "Divided by the x-coefficient from the question instead of the collected one: x = (d − b) / a",
  childLabel: "After you collect the x-terms, divide both sides by the number in front of x in that line, not the one in the question.",
  stepType: "divide",
  firstWrongLine: 5,
  lines: { "5": "x = {(d - b) / a}" },
  answerFormula: "(d - b) / a",
};
const WRONG_GUESS: MinedMistakeSpec = { ...DIVIDE_BY_A, id: "divided-d-by-a", lines: { "5": "x = {d / a}" }, answerFormula: "d / a" };

let ctx: Awaited<ReturnType<typeof setup>>;
afterEach(() => ctx?.done());

/** Logs n unknown wrong answers that "divide by a" explains, starting with 5/2 for 4x − 3 = 2x + 7. */
async function logDivideByAErrors(n: number) {
  const params: Record<string, number>[] = [{ a: 4, b: -3, c: 2, d: 7 }];
  for (let seed = 1; params.length < n; seed++) {
    const inst = linearBothSides.generate(createRng(seed));
    const typed = parseAnswer(toString(frac(inst.params.d - inst.params.b, inst.params.a)))!;
    if (typed.ok && diagnose(linearBothSides, inst, typed.value) === "unknown") params.push(inst.params);
  }
  for (const p of params) await ctx.store.recordUnknownError(SKILL, JSON.stringify(p), toString(frac(p.d - p.b, p.a)));
}

const goodScript = () =>
  scriptedModel([
    toolCall("get_unknown_errors", {}),
    toolCall("validate_mined_mistake", { mistake: WRONG_GUESS }), // a first guess that does not fit the data
    toolCall("validate_mined_mistake", { mistake: DIVIDE_BY_A }),
    toolCall("submit_draft", { mistake: DIVIDE_BY_A }),
    finalAnswer("never reached"),
  ]);

describe("the Misconception Miner (FAKE model)", () => {
  it("6 unknown errors → proposes (d − b) / a → validated → draft saved → approved → diagnosis, Teach and the stuck board use it", async () => {
    ctx = await setup({ cooldownHours: 0 });
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    await logDivideByAErrors(6);
    const masteryBefore = await ctx.store.getMastery(ctx.student.id, SKILL);
    const eventsBefore = (await ctx.store.listEvents()).length;

    const model = goodScript();
    const result = await runMiner({ model, ports: createMinerPorts(ctx.store), skillId: SKILL });
    expect(result).toMatchObject({ status: "draft_saved", validations: 2, unknownErrors: 6 });
    expect(result.attempts.map((a) => [a.answerFormula, a.ok, a.reproduced])).toEqual([
      ["d / a", false, 0],
      ["(d - b) / a", true, 6],
    ]);

    // the model saw only anonymous numbers
    const seen = JSON.stringify(model.requests);
    for (const secret of [ctx.student.id, "8B-17", "KV8B", ctx.cls.id]) expect(seen).not.toContain(secret);
    const toolResult = model.requests[1].messages.find((m) => m.role === "tool")!.content!;
    expect(JSON.parse(toolResult)[0]).toEqual({
      a: 4,
      b: -3,
      c: 2,
      d: 7,
      question: "4x − 3 = 2x + 7",
      correctAnswer: "5",
      wrongAnswer: "5/2",
      count: 1,
    });

    // mastery untouched by the agent, and nothing else written but the draft
    expect(await ctx.store.getMastery(ctx.student.id, SKILL)).toEqual(masteryBefore);
    expect((await ctx.store.listEvents()).slice(eventsBefore).map((e) => e.type)).toEqual([]);

    const pending = await ctx.svc.listPendingMinedMistakes();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ skillId: SKILL, spec: { id: "divided-by-a" }, report: { reproduced: 6 } });

    // before approval, diagnosis still says unknown; after approval it names the mined mistake
    const svc = createServices(ctx.store, { now: ctx.clock.now, cooldownHours: 0, random: () => 0.7 });
    const answerDivideByA = async () => {
      for (;;) {
        const served = await svc.servePracticeItem(ctx.student.id, SKILL);
        if (!served.ok) throw new Error(served.reason);
        const item = (await ctx.store.getItem(served.itemId))!;
        const p = JSON.parse(item.paramsJson);
        const inst = linearBothSides.generate(createRng(item.seed));
        const wrong = frac(p.d - p.b, p.a);
        if (diagnose(linearBothSides, inst, wrong) !== "unknown") continue; // need a question where only this explains it
        return svc.submitPracticeAnswer(served.itemId, toString(wrong));
      }
    };
    expect(await answerDivideByA()).toMatchObject({ mistakeId: "unknown" });
    expect(await svc.decideMinedMistake(ctx.cls.id, pending[0].id, "approved")).toEqual({ ok: true });
    // the first match only points to its line; the second different question names it
    expect(await answerDivideByA()).toMatchObject({ mistakeId: null, checkLine: 5, feedback: "Check line 5 again." });
    // approved without edits: the child sees the fixed message for its step type, never the AI's words
    const named = await answerDivideByA();
    expect(named).toMatchObject({ mistakeId: "divided-by-a", feedback: childMessage("divide", 5), feedbackKey: "child.step.divide" });
    expect(JSON.stringify(named)).not.toContain(DIVIDE_BY_A.childLabel);

    // the stuck board names it (a pattern: 2 different questions)
    const board = await svc.getStuckBoard(ctx.cls.id);
    expect(board.groups.some((g) => g.mistakeId === "divided-by-a" && g.label === DIVIDE_BY_A.label)).toBe(true);

    // Teach traces can use it, and the code checker (not the AI) decides the fix
    const session = await svc.startTeach(ctx.student.id, SKILL);
    if (!session.ok) throw new Error(session.reason);
    const mistakes = [];
    for (const t of session.traces) mistakes.push((await ctx.store.getItem(t.itemId))!.mistakeId);
    expect(mistakes).toContain("divided-by-a");
    let last;
    for (const t of session.traces) {
      const item = (await ctx.store.getItem(t.itemId))!;
      const fix =
        item.mistakeId === "divided-by-a"
          ? { line: 5, text: linearBothSides.solve(linearBothSides.generate(createRng(item.seed))).trace[4].text }
          : await correctFix(ctx.store, t.itemId);
      last = await svc.submitTeachStep(t.itemId, fix.line, fix.text);
      expect(last).toMatchObject({ ok: true, fixAccepted: true });
    }
    expect(last).toMatchObject({ state: "KEY1" });
  });

  it("does not call the model when fewer than 3 unknown errors are logged", async () => {
    ctx = await setup();
    await logDivideByAErrors(2);
    const model = goodScript();
    const result = await runMiner({ model, ports: createMinerPorts(ctx.store), skillId: SKILL });
    expect(result.status).toBe("not_enough_data");
    expect(model.requests).toHaveLength(0);
  });

  it("refuses submit_draft for JSON that has not passed validation", async () => {
    ctx = await setup();
    await logDivideByAErrors(6);
    const model = scriptedModel([toolCall("submit_draft", { mistake: DIVIDE_BY_A }), finalAnswer("gave up")]);
    const result = await runMiner({ model, ports: createMinerPorts(ctx.store), skillId: SKILL });
    expect(result.status).toBe("no_draft");
    expect(model.requests[1].messages.at(-1)?.content).toMatch(/validate/i);
    expect(await ctx.svc.listPendingMinedMistakes()).toEqual([]);
  });

  it("describes every field of a mined mistake to the model as a JSON schema", async () => {
    ctx = await setup();
    await logDivideByAErrors(6);
    const model = scriptedModel([finalAnswer("nothing")]);
    await runMiner({ model, ports: createMinerPorts(ctx.store), skillId: SKILL });
    const validate = model.requests[0].tools.find((t) => t.function.name === "validate_mined_mistake")!;
    const props = validate.function.parameters.properties as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual(["answerFormula", "childLabel", "firstWrongLine", "id", "label", "lines", "stepType"]);
  });

  it("when the AI fails part-way, reports it and keeps the proposals already checked", async () => {
    ctx = await setup();
    await logDivideByAErrors(6);
    let n = 0;
    const steps = [toolCall("get_unknown_errors", {}), toolCall("validate_mined_mistake", WRONG_GUESS)];
    const model = (async () => {
      if (n < steps.length) return { message: steps[n++], provider: "fake", model: "fake" };
      throw new Error("All AI providers failed: groq: HTTP 400");
    }) as Parameters<typeof runMiner>[0]["model"];
    const result = await runMiner({ model, ports: createMinerPorts(ctx.store), skillId: SKILL });
    expect(result).toMatchObject({ status: "failed", validations: 1, error: expect.stringMatching(/HTTP 400/) });
    expect(result.attempts.map((a) => a.answerFormula)).toEqual(["d / a"]);
  });

  it("refuses skills its formula templates do not fit (like terms has expression answers)", async () => {
    ctx = await setup();
    await expect(runMiner({ model: goodScript(), ports: createMinerPorts(ctx.store), skillId: "alg.like-terms" })).rejects.toThrow(/only supports/);
  });

  it("stops after 5 failed validations", async () => {
    ctx = await setup();
    await logDivideByAErrors(6);
    const model = scriptedModel(Array.from({ length: 10 }, () => toolCall("validate_mined_mistake", { mistake: WRONG_GUESS })));
    const result = await runMiner({ model, ports: createMinerPorts(ctx.store), skillId: SKILL });
    expect(result).toMatchObject({ status: "no_draft", validations: 5 });
    expect(model.requests).toHaveLength(5);
  });

  it("a teacher can edit the labels before approving; the edit is checked and saved with the approver", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    await logDivideByAErrors(6);
    await runMiner({ model: goodScript(), ports: createMinerPorts(ctx.store), skillId: SKILL });
    const [draft] = await ctx.svc.listPendingMinedMistakes();

    const bad = await ctx.svc.decideMinedMistake(ctx.cls.id, draft.id, "approved", { childLabel: "Move it across and change the sign." });
    expect(bad).toMatchObject({ ok: false, reason: expect.stringMatching(/NCERT/) });

    const childLabel = "You divided by the number in front of x in the question. First collect the x-terms, then divide both sides by the number in front of x in that line.";
    const edits = { label: "Divides by the original coefficient a, not by (a − c)", childLabel };
    expect(await ctx.svc.decideMinedMistake(ctx.cls.id, draft.id, "approved", edits)).toEqual({ ok: true });

    const row = (await ctx.store.getMinedMistake(draft.id))!;
    expect(row.status).toBe("APPROVED");
    expect(row.approver).toMatch(/teacher of class KV8B.*edited/);
    expect(JSON.parse(row.source)).toMatchObject({ ...edits, answerFormula: "(d - b) / a" }); // formula unchanged

    // the edited child label is shown from the second different question on (the first only points to the line)
    for (let matched = 0; matched < 2; ) {
      const served = await ctx.svc.servePracticeItem(ctx.student.id, SKILL);
      if (!served.ok) throw new Error(served.reason);
      const item = (await ctx.store.getItem(served.itemId))!;
      const p = JSON.parse(item.paramsJson);
      const wrong = frac(p.d - p.b, p.a);
      if (diagnose(linearBothSides, linearBothSides.generate(createRng(item.seed)), wrong) !== "unknown") continue;
      expect(await ctx.svc.submitPracticeAnswer(served.itemId, toString(wrong))).toMatchObject(
        matched === 0 ? { mistakeId: null, checkLine: 5 } : { mistakeId: "divided-by-a", feedback: childLabel },
      );
      matched++;
    }
  });

  it("a teacher can reject a draft, and an invalid draft can never be approved", async () => {
    ctx = await setup();
    await logDivideByAErrors(6);
    await runMiner({ model: goodScript(), ports: createMinerPorts(ctx.store), skillId: SKILL });
    const [draft] = await ctx.svc.listPendingMinedMistakes();
    await ctx.store.insertMinedMistake({
      id: "tampered",
      skillId: SKILL,
      source: JSON.stringify({ ...DIVIDE_BY_A, id: "tampered", answerFormula: "(d - b) / (a - c)" }),
      testsJson: "{}",
      status: "DRAFT_TESTED",
      approver: null,
      createdAt: ctx.clock.now().toISOString(),
    });
    expect(await ctx.svc.decideMinedMistake(ctx.cls.id, "tampered", "approved")).toMatchObject({ ok: false });
    expect(await ctx.svc.decideMinedMistake(ctx.cls.id, draft.id, "rejected")).toEqual({ ok: true });
    expect(await ctx.svc.decideMinedMistake(ctx.cls.id, draft.id, "approved")).toMatchObject({ ok: false });
  });
});

describe("smaller prompts: unknown errors are sent grouped", () => {
  it("100 raw errors with repeats → at most 40 groups, each (question, wrong answer) once with its total count, most frequent first", () => {
    const rng = createRng(7);
    const questions = Array.from({ length: 30 }, (_, i) => ({ a: 2 + (i % 7), b: -3 + i, c: 1, d: 5 + (i % 4) }));
    const raw: UnknownError[] = [];
    const expected = new Map<string, number>();
    for (let i = 0; i < 100; i++) {
      const params = questions[Math.floor(rng.next() * questions.length)];
      const wrongAnswer = String(Math.floor(rng.next() * 3));
      const count = 1 + Math.floor(rng.next() * 3);
      // the same params written with keys in another order are the same question
      raw.push({ params: i % 2 ? params : { d: params.d, c: params.c, b: params.b, a: params.a }, wrongAnswer, count });
      const key = `${params.a},${params.b},${params.c},${params.d}|${wrongAnswer}`;
      expected.set(key, (expected.get(key) ?? 0) + count);
    }
    expect(expected.size).toBeGreaterThan(MAX_ERROR_GROUPS); // so the cut at 40 is tested

    const groups = groupUnknownErrors(raw);
    expect(MAX_ERROR_GROUPS).toBe(40);
    expect(groups.length).toBe(40);
    const keys = groups.map((g) => `${g.params.a},${g.params.b},${g.params.c},${g.params.d}|${g.wrongAnswer}`);
    expect(new Set(keys).size).toBe(groups.length); // each once
    for (const [i, g] of groups.entries()) expect(g.count, keys[i]).toBe(expected.get(keys[i]));
    const counts = groups.map((g) => g.count!);
    expect(counts).toEqual([...counts].sort((p, q) => q - p));
    // the 40 kept are the most frequent ones
    const smallestKept = counts[counts.length - 1];
    const dropped = [...expected.entries()].filter(([k]) => !keys.includes(k)).map(([, n]) => n);
    for (const n of dropped) expect(n).toBeLessThanOrEqual(smallestKept);
  });

  it("an error without a count counts once; 5/2 and 10/4 are the same wrong answer", () => {
    const p = { a: 4, b: -3, c: 2, d: 7 };
    expect(groupUnknownErrors([{ params: p, wrongAnswer: "5/2" }, { params: p, wrongAnswer: "10/4", count: 2 }, { params: p, wrongAnswer: "6" }])).toEqual([
      { params: p, wrongAnswer: "5/2", count: 3 },
      { params: p, wrongAnswer: "6", count: 1 },
    ]);
  });

  it("the Miner sends the model at most 40 groups, sorted by count", async () => {
    ctx = await setup();
    for (let i = 0; i < 60; i++) {
      const params = { a: 3, b: i, c: 1, d: 100 };
      for (let k = 0; k <= i % 3; k++) await ctx.store.recordUnknownError(SKILL, JSON.stringify(params), "999");
    }
    const model = scriptedModel([toolCall("get_unknown_errors", {}), finalAnswer("nothing fits")]);
    await runMiner({ model, ports: createMinerPorts(ctx.store), skillId: SKILL });
    const sent = JSON.parse(model.requests[1].messages.find((m) => m.role === "tool")!.content!) as { count: number }[];
    expect(sent).toHaveLength(40);
    expect(sent.map((e) => e.count)).toEqual([...sent.map((e) => e.count)].sort((p, q) => q - p));
    expect(sent[0].count).toBe(3);
  });
});
