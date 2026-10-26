import { describe, expect, it } from "vitest";
import { parseAnswerFor, sameAnswer } from "../answer";
import { mistakeExample } from "../example";
import { toMistake } from "../minedMistake";
import { SKILLS } from "../skills";
import { linearBothSides } from "../skills/linear-both-sides";
import { applies, type Mistake, type SkillSpec } from "../types";

// The worked example shown for a mistake (stuck board, review card, open export): it must be a question the
// mistake APPLIES to, worked through with that mistake, so its last line is the mistake's own answer.
// (Live bug, 25 Oct: "divided the wrong way round" was shown on x + 5 = −1, where it does not apply.)

const BOARD_SEED = 20261018;

/** The value on the last working line ("x = 5/2" → 5/2, "3x − 12" → 3x − 12). */
function lastLineAnswer(skill: SkillSpec, lines: { text: string }[]) {
  const text = lines.at(-1)!.text;
  const parsed = parseAnswerFor(skill.answerKind, text.replace(/^x\s*=\s*/, ""));
  if (!parsed.ok) throw new Error(`cannot read the last line "${text}"`);
  return parsed.value;
}

function expectGoodExample(skill: SkillSpec, m: Mistake, firstSeed?: number) {
  const ex = mistakeExample(skill, m, firstSeed);
  expect(ex, `${skill.id} ${m.id}`).not.toBeNull();
  const { instance, trace, answer, firstWrongLine } = ex!;
  expect(applies(m, instance), `${skill.id} ${m.id}: ${instance.text}`).toBe(true);
  const out = m.apply(instance);
  expect(trace).toEqual(out.trace);
  expect(firstWrongLine).toBe(out.firstWrongLine);
  expect(sameAnswer(answer, out.answer)).toBe(true);
  expect(sameAnswer(lastLineAnswer(skill, trace), out.answer), `${skill.id} ${m.id}: last line ${trace.at(-1)!.text}`).toBe(true);
  expect(trace[0].text).toBe(instance.text);
  return ex!;
}

describe("mistakeExample", () => {
  it("for every skill and every authored mistake: a question it applies to, and the trace ends on the mistake's answer", () => {
    for (const { spec } of SKILLS) {
      for (const m of spec.mistakes) {
        expectGoodExample(spec, m); // seeds 1, 2, … (the open export)
        expectGoodExample(spec, m, BOARD_SEED); // the stuck board's seeds
      }
    }
  });

  it("the live bug: 'divided the wrong way round' is never shown on x + 5 = −1", () => {
    const skill = SKILLS.find((s) => s.spec.id === "alg.linear.one-step")!.spec;
    const m = skill.mistakes.find((x) => x.id === "divided-wrong-way")!;
    const ex = expectGoodExample(skill, m, BOARD_SEED);
    expect(ex.instance.text).not.toBe("x + 5 = −1");
    expect(ex.instance.params.a).not.toBe(1);
  });

  it("is deterministic, and starts at the seed it is given", () => {
    for (const { spec } of SKILLS) {
      for (const m of spec.mistakes) {
        expect(mistakeExample(spec, m, BOARD_SEED)).toEqual(mistakeExample(spec, m, BOARD_SEED));
        const ex = mistakeExample(spec, m, BOARD_SEED)!;
        expect(ex.instance.seed).toBeGreaterThanOrEqual(BOARD_SEED);
      }
    }
  });

  it("works for a mined mistake too, skipping questions where its formula divides by zero", () => {
    const mined = toMistake(
      { id: "divide-by-original-a", label: "l", childLabel: "c", stepType: "divide", firstWrongLine: 5, lines: { "5": "x = {(d - b) / a}" }, answerFormula: "(d - b) / a" },
      linearBothSides,
    );
    expectGoodExample(linearBothSides, mined, BOARD_SEED);
    const zero = toMistake(
      { id: "always-zero-divisor", label: "l", childLabel: "c", stepType: "divide", firstWrongLine: 5, lines: { "5": "x = {d / (a - a)}" }, answerFormula: "d / (a - a)" },
      linearBothSides,
    );
    expect(mistakeExample(linearBothSides, zero, BOARD_SEED, 20)).toBeNull();
  });
});
