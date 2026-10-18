import { afterEach, describe, expect, it } from "vitest";
import { parseAnswer } from "../../core/answer";
import { diagnose } from "../../core/diagnose";
import { frac, toString } from "../../core/fraction";
import type { MinedMistakeSpec } from "../../core/minedMistake";
import { createRng } from "../../core/rng";
import { linearBothSides } from "../../core/skills/linear-both-sides";
import { createMinerPorts } from "../../server/miner-ports";
import { createServices } from "../../server/services";
import { correctFix, SKILL, setup } from "../../server/__tests__/helpers";
import { finalAnswer, scriptedModel, toolCall } from "../fake-model";
import { runMiner } from "../miner";

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
  const params = [{ a: 4, b: -3, c: 2, d: 7 }];
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
    expect(await answerDivideByA()).toMatchObject({ mistakeId: "divided-by-a", feedback: DIVIDE_BY_A.childLabel });

    // the stuck board names it
    const board = await svc.getStuckBoard(ctx.cls.id);
    expect(board.some((g) => g.mistakeId === "divided-by-a" && g.label === DIVIDE_BY_A.label)).toBe(true);

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

  it("stops after 5 failed validations", async () => {
    ctx = await setup();
    await logDivideByAErrors(6);
    const model = scriptedModel(Array.from({ length: 10 }, () => toolCall("validate_mined_mistake", { mistake: WRONG_GUESS })));
    const result = await runMiner({ model, ports: createMinerPorts(ctx.store), skillId: SKILL });
    expect(result).toMatchObject({ status: "no_draft", validations: 5 });
    expect(model.requests).toHaveLength(5);
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
