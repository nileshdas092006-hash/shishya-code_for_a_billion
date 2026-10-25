import run from "../agents/__fixtures__/miner-run-2026-10-19.json";
import type { MinerAttempt } from "../agents/miner";
import type { AgentRunRow } from "./store";

// The one real past Misconception Miner run we have records of (2026-10-19), as a row of the run history,
// marked recorded. Every value comes from the fixture, which was copied from BUILD_LOG.md and
// data/agent-runs.jsonl; nothing is invented:
// - skillId: the Miner supports only alg.linear.both-sides, and the recorded question 4x − 3 = 2x + 7 is one of its;
// - startedAt: the first logged call; finishedAt: the last logged call's start plus its duration;
// - turns: one AI call per turn (3 calls); draftId: the draft lived only in a scratch database, so none here.

const last = run.calls[run.calls.length - 1];
const attempt: MinerAttempt = {
  id: run.proposal.id,
  answerFormula: run.proposal.answerFormula,
  ok: run.validation.passedFirstTry,
  reproduced: run.validation.explained,
  errors: [],
  checked: run.validation.checkedQuestions,
  overlaps: run.validation.overlaps,
};

export const RECORDED_MINER_RUN: AgentRunRow = {
  id: `recorded-miner-${run.date}`,
  agent: "miner",
  skillId: "alg.linear.both-sides",
  startedAt: run.calls[0].at,
  finishedAt: new Date(Date.parse(last.at) + last.ms).toISOString(),
  status: "draft_saved",
  turns: run.calls.length,
  provider: run.provider,
  model: run.model,
  attemptsJson: JSON.stringify([attempt]),
  draftId: null,
  error: null,
  recorded: true,
};
