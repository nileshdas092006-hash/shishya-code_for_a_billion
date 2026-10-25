import { randomUUID } from "node:crypto";
import type { ChatModel } from "../agents/llm";
import { runMiner, type MinerAttempt, type MinerResult } from "../agents/miner";
import type { MessageKey } from "../i18n";
import { createMinerPorts } from "./miner-ports";
import type { AgentRunRow, Store } from "./store";

// The agents' run history. The Miner wrapper writes one agentRuns row per run, to whatever database it runs on
// (a local file or Turso), so the teacher page "How the agent worked" can show it: Vercel has no lasting disk
// for a log file. A row holds only the proposals and the validator's verdicts: never any child data.

export { RECORDED_MINER_RUN } from "./recorded-runs";

const names = (s: Set<string>) => (s.size ? [...s].join(", ") : null);

/** Runs the Misconception Miner once and writes its row (also when it ends early or fails). */
export async function runMinerRecorded(opts: {
  store: Store;
  model: ChatModel;
  skillId: string;
  now?: () => Date;
  maxTurns?: number;
}): Promise<MinerResult & { runId: string }> {
  const now = opts.now ?? (() => new Date());
  const runId = randomUUID();
  const providers = new Set<string>();
  const models = new Set<string>();
  // which provider and model really answered (the client may fall back from one to another)
  const model: ChatModel = async (request) => {
    const reply = await opts.model(request);
    providers.add(reply.provider);
    models.add(reply.model);
    return reply;
  };
  const startedAt = now().toISOString();
  let result: MinerResult;
  try {
    result = await runMiner({ model, ports: createMinerPorts(opts.store, now, runId), skillId: opts.skillId, maxTurns: opts.maxTurns });
  } catch (e) {
    const error = e instanceof Error ? e.message : "the Miner failed";
    result = { status: "failed", error, unknownErrors: 0, validations: 0, turns: 0, attempts: [] };
  }
  await opts.store.insertAgentRun({
    id: runId,
    agent: "miner",
    skillId: opts.skillId,
    startedAt,
    finishedAt: now().toISOString(),
    status: result.status,
    turns: result.turns,
    provider: names(providers),
    model: names(models),
    attemptsJson: JSON.stringify(result.attempts),
    draftId: result.draftId ?? null,
    error: result.error?.slice(0, 500) ?? null,
    recorded: false,
  });
  return { ...result, runId };
}

export type Verdict = { key: MessageKey; params: Record<string, string | number> };

const MIN_EXPLAINED = 3;
const MAX_OVERLAP_SHARE = 0.1;
const number = (n: number) => n.toLocaleString("en-IN");

/** The validator's verdict on one proposal, in plain words (a message key and its numbers). */
export function attemptVerdict(a: MinerAttempt): Verdict {
  const total = a.checked ?? 0;
  if (a.ok) return { key: "agentRuns.verdict.accepted", params: { n: a.reproduced } };
  if (a.rightAnswerOn) return { key: "agentRuns.verdict.right", params: { n: number(a.rightAnswerOn), total: number(total) } };
  if (a.divideByZeroOn) return { key: "agentRuns.verdict.zero", params: { n: number(a.divideByZeroOn), total: number(total) } };
  // the reproduction count is only known once the proposal's shape passed (then questions were checked)
  if (total > 0 && a.reproduced < MIN_EXPLAINED) return { key: "agentRuns.verdict.few", params: { n: a.reproduced } };
  const [known, n] = Object.entries(a.overlaps ?? {}).sort(([, p], [, q]) => q - p)[0] ?? ["", 0];
  if (total > 0 && n > total * MAX_OVERLAP_SHARE) return { key: "agentRuns.verdict.known", params: { id: known, n: number(n), total: number(total) } };
  return { key: "agentRuns.verdict.other", params: { reason: a.errors[0] ?? "" } };
}

const STATUS_KEYS: Record<string, MessageKey> = {
  draft_saved: "agentRuns.status.draft_saved",
  no_draft: "agentRuns.status.no_draft",
  not_enough_data: "agentRuns.status.not_enough_data",
  failed: "agentRuns.status.failed",
};

/** A run as the teacher page shows it: the row, its status in plain words, and each proposal with its verdict. */
export function agentRunView(row: AgentRunRow) {
  let attempts: MinerAttempt[] = [];
  try {
    attempts = JSON.parse(row.attemptsJson) as MinerAttempt[];
  } catch {
    // a damaged row shows no proposals
  }
  return {
    id: row.id,
    agent: row.agent,
    skillId: row.skillId,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    status: row.status,
    statusText: { key: STATUS_KEYS[row.status] ?? "agentRuns.status.other", params: { status: row.status, error: row.error ?? "" } } as Verdict,
    turns: row.turns,
    provider: row.provider,
    model: row.model,
    draftId: row.draftId,
    recorded: row.recorded,
    attempts: attempts.map((a) => ({ id: a.id, answerFormula: a.answerFormula, ok: a.ok, verdict: attemptVerdict(a) })),
  };
}
