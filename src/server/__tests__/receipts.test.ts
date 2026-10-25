import { afterEach, describe, expect, it } from "vitest";
import { answerText } from "../../core/answer";
import { createRng } from "../../core/rng";
import { linearBothSides } from "../../core/skills/linear-both-sides";
import { correctFix, SKILL, setup, teachPerfectly } from "./helpers";

// Receipts ("How we checked") come with every verdict, but a proof shows none until it is finished.

let ctx: Awaited<ReturnType<typeof setup>>;
afterEach(() => ctx?.done());

async function proofReady() {
  ctx = await setup();
  await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
  await teachPerfectly(ctx.svc, ctx.store, ctx.student.id);
  const proof = await ctx.svc.startProof(ctx.student.id, SKILL);
  if (!proof.ok) throw new Error(proof.reason);
  return proof;
}

describe("receipts", () => {
  it("practise: every verdict has a receipt, and a wrong answer's receipt shows the check that does not hold", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    for (const wrong of [false, true]) {
      const served = await ctx.svc.servePracticeItem(ctx.student.id, SKILL);
      if (!served.ok) throw new Error(served.reason);
      const item = (await ctx.store.getItem(served.itemId))!;
      const inst = linearBothSides.generate(createRng(item.seed));
      const answer = wrong ? answerText(linearBothSides.mistakes[0].apply(inst).answer) : item.answer;
      const r = await ctx.svc.submitPracticeAnswer(served.itemId, answer);
      expect(r).toMatchObject({ ok: true, correct: !wrong, receipt: { kind: "substitute", holds: !wrong } });
    }
  });

  it("teach: a checked line on the right line has a receipt", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const session = await ctx.svc.startTeach(ctx.student.id, SKILL);
    if (!session.ok) throw new Error(session.reason);
    const fix = await correctFix(ctx.store, session.traces[0].itemId);
    const r = await ctx.svc.submitTeachStep(session.traces[0].itemId, fix.line, fix.wrongText);
    expect(r).toMatchObject({ ok: true, fixAccepted: false, receipt: { kind: "line", sameSolution: false } });
  });

  it("proof: no receipt while it runs; one per item, in order, once it is finished", async () => {
    const proof = await proofReady();
    const ids = proof.items.map((i) => i.itemId);
    expect(JSON.stringify(proof)).not.toMatch(/receipt|holds|leftValue/);

    const answers: string[] = [];
    for (const [i, id] of ids.entries()) {
      const correct = (await ctx.store.getItem(id))!.answer;
      answers.push(i === 1 ? `${correct}01` : correct);
    }
    for (const [i, id] of ids.slice(0, -1).entries()) {
      const r = await ctx.svc.submitProofAnswer(id, answers[i]);
      expect(r).toEqual({ ok: true, finished: false });
      const resumed = await ctx.svc.resumeProof(ctx.student.id, SKILL);
      expect(JSON.stringify(resumed)).not.toMatch(/receipt|holds|leftValue/);
    }

    const done = await ctx.svc.submitProofAnswer(ids.at(-1)!, answers.at(-1)!);
    if (!done.ok || !done.finished) throw new Error("the proof should be finished");
    expect(done.receipts.map((r) => r.itemId)).toEqual(ids);
    expect(done.receipts.map((r) => r.receipt?.holds)).toEqual([true, false, true, true]);
    for (const r of done.receipts) expect(r.question).toMatch(/=/);
  });
});
