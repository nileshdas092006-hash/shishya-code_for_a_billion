import { afterEach, describe, expect, it } from "vitest";
import { answerText } from "../../core/answer";
import { createRng } from "../../core/rng";
import { SKILLS } from "../../core/skills";
import { applies } from "../../core/types";
import { instanceFor } from "../skills";
import { setup } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
afterEach(() => ctx?.done());

describe("every skill in the chain works end to end (practise → teach → prove)", () => {
  for (const { spec, generateApply } of SKILLS) {
    it(spec.id, async () => {
      ctx = await setup({ cooldownHours: 0 });
      const id = ctx.student.id;
      await ctx.svc.teacherUnlock(id, spec.id);
      const entry = SKILLS.find((s) => s.spec.id === spec.id)!;

      // practise: a mistake's answer is diagnosed; the first match only points to its line, the second
      // different question names it; the right answer is accepted (typed as a child would)
      const mistakeId = spec.mistakes[0].id;
      for (let matched = 0; matched < 2; ) {
        const served = await ctx.svc.servePracticeItem(id, spec.id);
        if (!served.ok) throw new Error(served.reason);
        const item = (await ctx.store.getItem(served.itemId))!;
        const inst = instanceFor(entry, item);
        const m = spec.mistakes.find((x) => x.id === mistakeId && applies(x, inst));
        if (!m) {
          await ctx.svc.submitPracticeAnswer(served.itemId, item.answer);
          continue;
        }
        const out = m.apply(inst);
        const r = await ctx.svc.submitPracticeAnswer(served.itemId, answerText(out.answer));
        expect(r).toMatchObject(
          matched === 0
            ? { ok: true, correct: false, mistakeId: null, checkLine: out.firstWrongLine }
            : { ok: true, correct: false, mistakeId: m.id, checkLine: null, feedback: m.childLabel },
        );
        matched++;
      }
      const again = await ctx.svc.servePracticeItem(id, spec.id);
      if (!again.ok) throw new Error(again.reason);
      expect(await ctx.svc.submitPracticeAnswer(again.itemId, (await ctx.store.getItem(again.itemId))!.answer)).toMatchObject({ correct: true });

      // teach: each Shishya trace uses a question its mistake applies to; correct fixes earn KEY1
      const session = await ctx.svc.startTeach(id, spec.id);
      if (!session.ok) throw new Error(session.reason);
      let last;
      for (const t of session.traces) {
        const item = (await ctx.store.getItem(t.itemId))!;
        const inst = instanceFor(entry, item);
        const m = spec.mistakes.find((x) => x.id === item.mistakeId)!;
        expect(applies(m, inst), `${m.id} on ${inst.text}`).toBe(true);
        const out = m.apply(inst);
        expect(t.lines).toEqual(out.trace.map((l) => l.text));
        const fix = spec.solve(inst).trace[out.firstWrongLine - 1].text;
        last = await ctx.svc.submitTeachStep(t.itemId, out.firstWrongLine, fix);
        expect(last, `${m.id}: "${fix}" for ${inst.text}`).toMatchObject({ ok: true, lineCorrect: true, fixAccepted: true });
      }
      expect(last).toMatchObject({ state: "KEY1" });

      // prove: 3 solve + 1 word problem, typed answers → MASTERED
      const run = await ctx.svc.startProof(id, spec.id);
      if (!run.ok) throw new Error(run.reason);
      expect(run.items.map((i) => i.format).sort()).toEqual(["apply", "solve", "solve", "solve"]);
      let done;
      for (const i of run.items) done = await ctx.svc.submitProofAnswer(i.itemId, (await ctx.store.getItem(i.itemId))!.answer);
      expect(done).toMatchObject({ finished: true, passed: true, state: "MASTERED" });
      expect(generateApply(createRng(1)).instance.skillId).toBe(spec.id);
    });
  }

  it("projector mode always shows a mistake that applies to its question", async () => {
    ctx = await setup();
    for (const { spec } of SKILLS) {
      for (let i = 0; i < 20; i++) {
        const t = await ctx.svc.projectorTrace(ctx.cls.id, spec.id);
        const inst = spec.generate(createRng(t.seed));
        const m = spec.mistakes.find((x) => x.id === t.mistakeId)!;
        expect(applies(m, inst), `${spec.id} ${m.id} on ${inst.text}`).toBe(true);
        expect(t.lines).toEqual(m.apply(inst).trace.map((l) => l.text));
      }
    }
  });
});
