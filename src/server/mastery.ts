import { parseAnswerFor, sameAnswer } from "../core/answer";
import { checkTeachStep } from "../core/teach";
import { instanceFor, type SkillEntry } from "./skills";
import type { ItemRow, MasteryState, ProofRunRow, Store } from "./store";

// The mastery engine: the ONLY code allowed to write the mastery table (a test enforces this).
//
//   LOCKED ──(prerequisites MASTERED, or teacher unlock)──▶ OPEN
//   OPEN ──(teach rule met on the current version)──▶ KEY1
//   KEY1 / NOT_YET ──(one fully correct proof run)──▶ MASTERED
//   KEY1 / NOT_YET ──(failed proof run)──▶ NOT_YET (KEY1 kept; next proof after the cooldown)
//
// It never trusts stored "correct" flags: every decision re-creates the questions from their seeds and
// re-checks the child's own answers and typed lines with src/core. No AI output is read here.

export type { MasteryState } from "./store";

export const PROOF_TIME_LIMIT_MINUTES = 30;
export const DEFAULT_PROOF_COOLDOWN_HOURS = 24;

type Evidence = {
  unlock?: { by: "teacher" } | { by: "prerequisites"; prerequisites: string[] };
  key1?: { sessionId: string; itemIds: string[]; traceIds: string[]; version: string };
  proof?: { runId: string; itemIds: string[]; version: string };
  failedProofs?: { runId: string; version: string; reasons: string[] }[];
};

/** PROOF_COOLDOWN_HOURS: hours between a failed proof and the next one. Default 24; 0 allowed for demos. */
export function proofCooldownHours(env: Record<string, string | undefined> = process.env): number {
  const raw = env.PROOF_COOLDOWN_HOURS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_PROOF_COOLDOWN_HOURS;
  const hours = Number(raw);
  return Number.isFinite(hours) && hours >= 0 ? hours : DEFAULT_PROOF_COOLDOWN_HOURS;
}

async function readEvidence(store: Store, studentId: string, skillId: string): Promise<Evidence> {
  const row = await store.getMastery(studentId, skillId);
  return row ? (JSON.parse(row.evidenceJson) as Evidence) : {};
}

/** The current state. KEY1 / NOT_YET earned on an older skill version count as OPEN (teach again). */
export async function getState(store: Store, studentId: string, entry: SkillEntry): Promise<MasteryState> {
  const row = await store.getMastery(studentId, entry.spec.id);
  if (!row) return "LOCKED";
  if ((row.state === "KEY1" || row.state === "NOT_YET") && row.version !== entry.spec.version) return "OPEN";
  return row.state;
}

async function write(
  store: Store,
  studentId: string,
  entry: SkillEntry,
  to: MasteryState,
  evidence: Evidence,
  now: Date,
): Promise<MasteryState> {
  const at = now.toISOString();
  await store.transaction(async () => {
    const from = await getState(store, studentId, entry);
    await store.writeMastery({
      studentId,
      skillId: entry.spec.id,
      state: to,
      evidenceJson: JSON.stringify(evidence),
      version: entry.spec.version,
      updatedAt: at,
    });
    await store.logEvent(studentId, "mastery_changed", { skillId: entry.spec.id, version: entry.spec.version, from, to, evidence }, at);
  });
  return to;
}

/** LOCKED → OPEN when every prerequisite is MASTERED (a skill with none opens at once). */
export async function refreshUnlock(store: Store, studentId: string, entry: SkillEntry, now: Date): Promise<MasteryState> {
  const state = await getState(store, studentId, entry);
  if (state !== "LOCKED") return state;
  const prerequisites = entry.spec.prerequisites;
  for (const p of prerequisites) if ((await store.getMastery(studentId, p))?.state !== "MASTERED") return state;
  const evidence = { ...(await readEvidence(store, studentId, entry.spec.id)), unlock: { by: "prerequisites" as const, prerequisites } };
  return write(store, studentId, entry, "OPEN", evidence, now);
}

/** LOCKED → OPEN because the teacher says so. */
export async function teacherUnlock(store: Store, studentId: string, entry: SkillEntry, now: Date): Promise<MasteryState> {
  const state = await getState(store, studentId, entry);
  if (state !== "LOCKED") return state;
  const evidence = { ...(await readEvidence(store, studentId, entry.spec.id)), unlock: { by: "teacher" as const } };
  return write(store, studentId, entry, "OPEN", evidence, now);
}

const paramsMatch = (entry: SkillEntry, item: ItemRow) => JSON.stringify(instanceFor(entry, item).params) === item.paramsJson;

/** The accepted try ids of a teach session if it meets the teach rule, else null. */
async function qualifyingTraceIds(store: Store, entry: SkillEntry, items: ItemRow[]): Promise<string[] | null> {
  const { traces, distinctMistakesMin, triesMax } = entry.spec.teachRule;
  if (items.length !== traces) return null;
  const known = new Set(entry.spec.mistakes.map((m) => m.id));
  if (!items.every((i) => i.mistakeId && known.has(i.mistakeId))) return null;
  if (new Set(items.map((i) => i.mistakeId)).size < distinctMistakesMin) return null;

  const traceIds: string[] = [];
  for (const item of items) {
    if (!paramsMatch(entry, item)) return null;
    const instance = instanceFor(entry, item);
    const tries = (await store.listTeachTraces(item.id)).slice(0, triesMax);
    const fixed = tries.find((t) => {
      if (t.mistakeId !== item.mistakeId) return false;
      const check = checkTeachStep(instance, item.mistakeId!, t.tappedLine, t.typedLine, entry.spec.mistakes);
      return check.lineCorrect && check.fixAccepted;
    });
    if (!fixed) return null;
    traceIds.push(fixed.id);
  }
  return traceIds;
}

/** OPEN → KEY1 when one teach session on the current version meets the teach rule. */
export async function evaluateTeach(store: Store, studentId: string, entry: SkillEntry, now: Date): Promise<MasteryState> {
  const state = await getState(store, studentId, entry);
  if (state !== "OPEN") return state;
  const items = await store.listItems({ studentId, skillId: entry.spec.id, kind: "teach", version: entry.spec.version });
  const sessions = new Map<string, ItemRow[]>();
  for (const item of items) if (item.runId) sessions.set(item.runId, [...(sessions.get(item.runId) ?? []), item]);

  for (const [sessionId, sessionItems] of sessions) {
    const traceIds = await qualifyingTraceIds(store, entry, sessionItems);
    if (!traceIds) continue;
    const evidence: Evidence = {
      ...(await readEvidence(store, studentId, entry.spec.id)),
      key1: { sessionId, itemIds: sessionItems.map((i) => i.id), traceIds, version: entry.spec.version },
    };
    return write(store, studentId, entry, "KEY1", evidence, now);
  }
  return state;
}

export type Eligibility =
  | { ok: true }
  | { ok: false; code: "mastered" | "not_ready" | "cooldown"; reason: string; retryAt?: string };

/** May this child start a proof now? (KEY1 held, and not cooling down after a failed proof.) */
export async function proofEligibility(
  store: Store,
  studentId: string,
  entry: SkillEntry,
  now: Date,
  cooldownHours: number,
): Promise<Eligibility> {
  const state = await getState(store, studentId, entry);
  if (state === "MASTERED") return { ok: false, code: "mastered", reason: "This skill is already mastered." };
  if (state !== "KEY1" && state !== "NOT_YET") return { ok: false, code: "not_ready", reason: "Teach the Shishya first, then you can prove it." };
  const last = await store.getLastFinishedProofRun(studentId, entry.spec.id);
  if (last && last.passed === false && last.finishedAt) {
    const retryAt = new Date(Date.parse(last.finishedAt) + cooldownHours * 3600_000);
    if (now < retryAt) {
      return {
        ok: false,
        code: "cooldown",
        reason: "Practise and teach a little more. Your next proof opens later.",
        retryAt: retryAt.toISOString(),
      };
    }
  }
  return { ok: true };
}

/** Checks a proof run from scratch with src/core. Every reason it fails is listed. */
export async function verifyProofRun(store: Store, entry: SkillEntry, run: ProofRunRow): Promise<{ passed: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const rule = entry.spec.proofRule;
  if (!run.aiOff) reasons.push("AI was not off");
  if (run.version !== entry.spec.version) reasons.push("old skill version");
  if (run.skillId !== entry.spec.id) reasons.push("wrong skill");

  const deadline = Date.parse(run.startedAt) + PROOF_TIME_LIMIT_MINUTES * 60_000;
  const formats = { solve: 0, apply: 0 };
  for (const [i, id] of run.itemIds.entries()) {
    const item = await store.getItem(id);
    if (!item) {
      reasons.push(`item ${i + 1} missing`);
      continue;
    }
    if (item.kind !== "proof" || item.runId !== run.id || item.studentId !== run.studentId || item.skillId !== run.skillId) {
      reasons.push(`item ${i + 1} does not belong to this run`);
      continue;
    }
    formats[item.format]++;
    if (!paramsMatch(entry, item)) {
      reasons.push(`item ${i + 1} does not match its seed`);
      continue;
    }
    const attempts = await store.listAttemptsForItem(item.id);
    if (attempts.length !== 1) {
      reasons.push(`item ${i + 1} not answered exactly once`);
      continue;
    }
    const typed = parseAnswerFor(entry.spec.answerKind, attempts[0].answer);
    if (!typed.ok || !sameAnswer(typed.value, instanceFor(entry, item).answer)) reasons.push(`item ${i + 1} wrong`);
    if (Date.parse(attempts[0].createdAt) > deadline) reasons.push(`item ${i + 1} answered after ${PROOF_TIME_LIMIT_MINUTES} minutes`);
  }
  if (formats.solve !== rule.solve || formats.apply !== rule.apply) reasons.push("wrong mix of items");
  return { passed: rule.allCorrect && reasons.length === 0, reasons };
}

/** After a proof run is finished: KEY1 / NOT_YET → MASTERED if it passes, otherwise NOT_YET (KEY1 kept). */
export async function recordProof(store: Store, studentId: string, entry: SkillEntry, runId: string, now: Date): Promise<MasteryState> {
  const run = await store.getProofRun(runId);
  if (!run || run.studentId !== studentId) throw new Error(`Proof run ${runId} not found for this student`);
  if (!run.finishedAt) throw new Error(`Proof run ${runId} is not finished`);
  const state = await getState(store, studentId, entry);
  if (state !== "KEY1" && state !== "NOT_YET") return state;

  const verdict = await verifyProofRun(store, entry, run);
  const evidence = await readEvidence(store, studentId, entry.spec.id);
  if (verdict.passed) {
    return write(store, studentId, entry, "MASTERED", { ...evidence, proof: { runId, itemIds: run.itemIds, version: run.version } }, now);
  }
  const failedProofs = [...(evidence.failedProofs ?? []), { runId, version: run.version, reasons: verdict.reasons }];
  return write(store, studentId, entry, "NOT_YET", { ...evidence, failedProofs }, now);
}
