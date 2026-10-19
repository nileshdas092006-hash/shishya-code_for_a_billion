import { describe, expect, it } from "vitest";
import { answerText, sameAnswer } from "../answer";
import { diagnose } from "../diagnose";
import { createRng } from "../rng";
import type { SkillEntry } from "../skills";
import { applies, type Answer } from "../types";

// The same property-test standard for every skill (used by each skill's own test file, and by skills the
// Skill Author agent drafts). Over 1,000 seeded questions:
//   - the same seed gives the same question; solve() gives the question's answer; the trace starts with the question
//   - every mistake that applies: never the correct answer, all different, first wrong line correct
//   - the line checker accepts every correct line and rejects the Shishya's first wrong line
//   - diagnose() names each mistake from its answer; every question has at least one mistake that applies
//   - word problems ("apply" items) are valid questions of this skill
//   - hints and child labels use NCERT language and never give away the answer

const NOT_NCERT = /\bmov(e|es|ed|ing)\b|change (the|its) sign/i;
const lines = (trace: { text: string }[]) => trace.map((l) => l.text);

export function describeSkillProperties(
  entry: SkillEntry,
  opts: { seeds?: number; leak?: (answer: Answer) => RegExp | null } = {},
) {
  const { spec, generateApply } = entry;
  const seeds = Array.from({ length: opts.seeds ?? 1000 }, (_, i) => i + 1);
  const gen = (seed: number) => spec.generate(createRng(seed));

  describe(`${spec.id}: property tests over ${seeds.length} seeds`, () => {
    it("the same seed gives the same question; solve() gives its answer; the working starts with the question", () => {
      for (const seed of seeds) {
        const inst = gen(seed);
        expect(gen(seed)).toEqual(inst);
        expect(inst.skillId).toBe(spec.id);
        expect(inst.seed).toBe(seed);
        const { trace, answer } = spec.solve(inst);
        expect(sameAnswer(answer, inst.answer), `seed ${seed}`).toBe(true);
        expect(trace[0].text).toBe(inst.text);
        expect(trace.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("every mistake that applies: never the correct answer, all different, first wrong line correct", () => {
      for (const seed of seeds) {
        const inst = gen(seed);
        const correct = lines(spec.solve(inst).trace);
        const outs = spec.mistakes.filter((m) => applies(m, inst)).map((m) => ({ m, out: m.apply(inst) }));
        expect(outs.length, `seed ${seed}: no mistake applies to ${inst.text}`).toBeGreaterThan(0);
        for (const { m, out } of outs) {
          expect(sameAnswer(out.answer, inst.answer), `${m.id} seed ${seed} ${inst.text}`).toBe(false);
          const wrong = lines(out.trace);
          const first = wrong.findIndex((t, i) => t !== correct[i]) + 1;
          expect(out.firstWrongLine, `${m.id} seed ${seed} ${inst.text}`).toBe(first);
        }
        for (let i = 0; i < outs.length; i++) {
          for (let j = i + 1; j < outs.length; j++) {
            expect(sameAnswer(outs[i].out.answer, outs[j].out.answer), `${outs[i].m.id} = ${outs[j].m.id}, seed ${seed}`).toBe(false);
          }
        }
      }
    });

    it("the line checker accepts every correct line and rejects the Shishya's first wrong line", () => {
      for (const seed of seeds) {
        const inst = gen(seed);
        const correct = lines(spec.solve(inst).trace);
        for (let line = 2; line <= correct.length; line++) {
          expect(spec.checkLine(inst, line, correct[line - 1]).ok, `line ${line} "${correct[line - 1]}" of ${inst.text}`).toBe(true);
        }
        for (const m of spec.mistakes.filter((x) => applies(x, inst))) {
          const out = m.apply(inst);
          const wrongLine = out.trace[out.firstWrongLine - 1].text;
          expect(spec.checkLine(inst, out.firstWrongLine, wrongLine).ok, `${m.id}: "${wrongLine}" for ${inst.text}`).toBe(false);
        }
      }
    });

    it("diagnose() names each mistake from its answer", () => {
      for (const seed of seeds) {
        const inst = gen(seed);
        for (const m of spec.mistakes.filter((x) => applies(x, inst))) {
          expect(diagnose(spec, inst, m.apply(inst).answer), `${m.id} seed ${seed}`).toBe(m.id);
        }
      }
    });

    it("word problems are valid questions of this skill, in English and Hindi", () => {
      for (const seed of seeds.slice(0, 300)) {
        const item = generateApply(createRng(seed));
        expect(item.instance.skillId).toBe(spec.id);
        expect(sameAnswer(spec.solve(item.instance).answer, item.instance.answer)).toBe(true);
        expect(item.text.length).toBeGreaterThan(20);
        expect(item.textHi.length).toBeGreaterThan(20);
        expect(generateApply(createRng(seed))).toEqual(item);
      }
    });

    it("hints and child labels use NCERT language, and hints never give away the answer", () => {
      expect(spec.hintLadder).toHaveLength(4);
      for (const text of [...spec.hintLadder, ...spec.mistakes.map((m) => m.childLabel)]) expect(text).not.toMatch(NOT_NCERT);
      if (!opts.leak) return;
      for (const seed of seeds) {
        const inst = gen(seed);
        const leak = opts.leak(inst.answer);
        if (!leak) continue;
        for (const hint of spec.hintLadder) expect(hint, `${answerText(inst.answer)} in a hint`).not.toMatch(leak);
      }
    });
  });
}
