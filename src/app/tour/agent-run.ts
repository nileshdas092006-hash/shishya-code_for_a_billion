import { answerText } from "@/core/answer";
import { childMessageKey, childMessageParams } from "@/core/childMessages";
import { explainedErrors, toMistake, validateMinedMistake, validationChecks, type MinedMistakeSpec } from "@/core/minedMistake";
import { linearBothSides, makeInstance } from "@/core/skills/linear-both-sides";
import { t } from "@/i18n";
import type { MinerAttempt } from "@/agents/miner";
import run from "@/agents/__fixtures__/miner-run-2026-10-19.json";
import { RECORDED_MINER_RUN } from "@/server/recorded-runs";
import type { AgentRunRow } from "@/server/store";

// The Judge Tour's stop 6: ONE recorded, real Misconception Miner run, read from the run history (the agentRuns
// row marked recorded, imported from the local records of that run). The row has the date, model, turns and the
// proposal with its verdict; the details the table does not keep (the AI calls, the logged question, the AI's
// child message) come from the same fixture the row was built from. Read-only: nothing here calls the AI or
// writes to the database. The example working is not stored: it is worked out again by src/core. So are the 4 ticks
// (the validator runs again on the recorded formula) and the one evidence row whose question kept its numbers.

export type RecordedRun = ReturnType<typeof recordedRun>;

export function recordedRun(row: AgentRunRow = RECORDED_MINER_RUN) {
  if (!row.recorded || row.id !== RECORDED_MINER_RUN.id) throw new Error("Stop 6 shows only the recorded Miner run.");
  const [attempt] = JSON.parse(row.attemptsJson) as MinerAttempt[];
  const p = run.proposal;
  // the records do not keep the AI's teacher label, so the mistake's id stands in for it (it is never shown as a label)
  const spec: MinedMistakeSpec = {
    id: attempt.id,
    label: attempt.id,
    childLabel: p.childLabelExcerpt,
    stepType: p.stepType as MinedMistakeSpec["stepType"],
    firstWrongLine: p.firstWrongLine,
    lines: p.lines,
    answerFormula: attempt.answerFormula,
  };
  const { a, b, c, d } = run.input.example.params;
  const question = makeInstance({ a, b, c, d }, 0);
  const wrong = toMistake(spec, linearBothSides).apply(question);
  // the recorded answers: only the example kept its question's numbers, so it is the only one code can check again
  const recordedErrors = [{ params: { a, b, c, d }, wrongAnswer: run.input.example.wrongAnswer }];
  const now = validateMinedMistake(spec, { skill: linearBothSides, unknownErrors: recordedErrors, existing: linearBothSides.mistakes });
  const explained = attempt.reproduced;
  const ms = run.calls.reduce((sum, call) => sum + call.ms, 0);
  const date = row.startedAt.slice(0, 10);
  return {
    label: t("tour.agent.recorded", { date }),
    date,
    model: row.model ?? run.model,
    calls: run.calls,
    seconds: Math.round(ms / 1000),
    otherWrongAnswers: run.input.otherWrongAnswers,
    proposal: { ...p, id: attempt.id, answerFormula: attempt.answerFormula },
    validation: { ...run.validation, explained, checkedQuestions: attempt.checked ?? run.validation.checkedQuestions },
    /** What a child sees for this mistake today: the fixed message for its step type (never the AI's words). */
    childNow: t(childMessageKey(spec.stepType), childMessageParams(spec.firstWrongLine)),
    /** The 4 ticks, worked out again now; the first counts the recorded run's explained answers (their numbers were not kept). */
    checkedNow: validationChecks({ ...now, reproduced: explained }),
    /** The recorded wrong answers it explains, checked again now: only the example's question was kept. */
    evidence: explainedErrors(spec, recordedErrors),
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
