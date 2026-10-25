import { answerText } from "@/core/answer";
import { toMistake, type MinedMistakeSpec } from "@/core/minedMistake";
import { linearBothSides, makeInstance } from "@/core/skills/linear-both-sides";
import { t } from "@/i18n";
import run from "@/agents/__fixtures__/miner-run-2026-10-19.json";

// The Judge Tour's stop 6: ONE recorded, real Misconception Miner run (a fixture copied from the local records of
// that run; see its "sources"). Read-only: nothing here calls the AI or writes to the database. The example
// working is not stored: it is worked out again by src/core from the recorded proposal.

export type RecordedRun = ReturnType<typeof recordedRun>;

export function recordedRun() {
  const p = run.proposal;
  // the records do not keep the AI's teacher label, so the mistake's id stands in for it (it is never shown as a label)
  const spec: MinedMistakeSpec = {
    id: p.id,
    label: p.id,
    childLabel: p.childLabelExcerpt,
    stepType: p.stepType as MinedMistakeSpec["stepType"],
    firstWrongLine: p.firstWrongLine,
    lines: p.lines,
    answerFormula: p.answerFormula,
  };
  const { a, b, c, d } = run.input.example.params;
  const question = makeInstance({ a, b, c, d }, 0);
  const wrong = toMistake(spec, linearBothSides).apply(question);
  const ms = run.calls.reduce((sum, call) => sum + call.ms, 0);
  return {
    label: t("tour.agent.recorded", { date: run.date }),
    date: run.date,
    model: run.model,
    calls: run.calls,
    seconds: Math.round(ms / 1000),
    otherWrongAnswers: run.input.otherWrongAnswers,
    proposal: p,
    validation: run.validation,
    example: {
      question: question.text,
      trace: wrong.trace.map((l) => l.text),
      firstWrongLine: wrong.firstWrongLine,
      wrongAnswer: answerText(wrong.answer),
      recordedWrongAnswer: run.input.example.wrongAnswer,
      correct: `x = ${answerText(question.answer)}`,
    },
  };
}
