import { parseAnswer } from "../core/answer";
import { equals } from "../core/fraction";
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

function readEvidence(store: Store, studentId: string, skillId: string): Evidence {
  const row = store.getMastery(studentId, skillId);
  return row ? (JSON.parse(row.evidenceJson) as Evidence) : {};
}

/** The current state. KEY1 / NOT_YET earned on an older skill version count as OPEN (teach again). */
export function getState(store: Store, studentId: string, entry: SkillEntry): MasteryState {
  const row = store.getMastery(studentId, entry.spec.id);
  if (!row) return "LOCKED";
  if ((row.state === "KEY1" || row.state === "NOT_YET") && row.version !== entry.spec.version) return "OPEN";
  return row.state;
}

function write(
  store: Store,
  studentId: string,
  entry: SkillEntry,
  to: MasteryState,
  evidence: Evidence,
  now: Date,
): MasteryState {
  const from = getState(store, studentId, entry);
  const at = now.toISOString();
  store.transaction(() => {
    store.writeMastery({
      studentId,
      skillId: entry.spec.id,
      state: to,
      evidenceJson: JSON.stringify(evidence),
      version: entry.spec.version,
      updatedAt: at,
    });
    store.logEvent(studentId, "mastery_changed", { skillId: entry.spec.id, version: entry.spec.version, from, to, evidence }, at);
  });
  return to;
}

/** LOCKED → OPEN when every prerequisite is MASTERED (a skill with none opens at once). */
export function refreshUnlock(store: Store, studentId: string, entry: SkillEntry, now: Date): MasteryState {
  const state = getState(store, studentId, entry);
  if (state !== "LOCKED") return state;
  const prerequisites = entry.spec.prerequisites;
  if (!prerequisites.every((p) => store.getMastery(studentId, p)?.state === "MASTERED")) return state;
  return write(store, studentId, entry, "OPEN", { ...readEvidence(store, studentId, entry.spec.id), unlock: { by: "prerequisites", prerequisites } }, now);
}

/** LOCKED → OPEN because the teacher says so. */
export function teacherUnlock(store: Store, studentId: string, entry: SkillEntry, now: Date): MasteryState {
  const state = getState(store, studentId, entry);
  if (state !== "LOCKED") return state;
  return write(store, studentId, entry, "OPEN", { ...readEvidence(store, studentId, entry.spec.id), unlock: { by: "teacher" } }, now);
}

const paramsMatch = (entry: SkillEntry, item: ItemRow) => JSON.stringify(instanceFor(entry, item).params) === item.paramsJson;

/** The accepted try ids of a teach session if it meets the teach rule, else null. */
function qualifyingTraceIds(store: Store, entry: SkillEntry, items: ItemRow[]): string[] | null {
  const { traces, distinctMistakesMin, triesMax } = entry.spec.teachRule;
  if (items.length !== traces) return null;
  const known = new Set(entry.spec.mistakes.map((m) => m.id));
  if (!items.every((i) => i.mistakeId && known.has(i.mistakeId))) return null;
  if (new Set(items.map((i) => i.mistakeId)).size < distinctMistakesMin) return null;

  const traceIds: string[] = [];
  for (const item of items) {
    if (!paramsMatch(entry, item)) return null;
    const instance = instanceFor(entry, item);
    const fixed = store
      .listTeachTraces(item.id)
      .slice(0, triesMax)
      .find((t) => {
        if (t.mistakeId !== item.mistakeId) return false;
        const check = checkTeachStep(instance, item.mistakeId!, t.tappedLine, t.typedLine);
        return check.lineCorrect && check.fixAccepted;
      });
    if (!fixed) return null;
    traceIds.push(fixed.id);
  }
  return traceIds;
}

/** OPEN → KEY1 when one teach session on the current version meets the teach rule. */
export function evaluateTeach(store: Store, studentId: string, entry: SkillEntry, now: Date): MasteryState {
  const state = getState(store, studentId, entry);
  if (state !== "OPEN") return state;
  const items = store.listItems({ studentId, skillId: entry.spec.id, kind: "teach", version: entry.spec.version });
  const sessions = new Map<string, ItemRow[]>();
  for (const item of items) if (item.runId) sessions.set(item.runId, [...(sessions.get(item.runId) ?? []), item]);

  for (const [sessionId, sessionItems] of sessions) {
    const traceIds = qualifyingTraceIds(store, entry, sessionItems);
    if (!traceIds) continue;
    const evidence: Evidence = {
      ...readEvidence(store, studentId, entry.spec.id),
      key1: { sessionId, itemIds: sessionItems.map((i) => i.id), traceIds, version: entry.spec.version },
    };
    return write(store, studentId, entry, "KEY1", evidence, now);
  }
  return state;
}

export type Eligibility = { ok: true } | { ok: false; reason: string; retryAt?: string };

/** May this child start a proof now? (KEY1 held, and not cooling down after a failed proof.) */
export function proofEligibility(
  store: Store,
  studentId: string,
  entry: SkillEntry,
  now: Date,
  cooldownHours: number,
): Eligibility {
  const state = getState(store, studentId, entry);
  if (state === "MASTERED") return { ok: false, reason: "This skill is already mastered." };
  if (state !== "KEY1" && state !== "NOT_YET") return { ok: false, reason: "Teach the Shishya first, then you can prove it." };
  const last = store.getLastFinishedProofRun(studentId, entry.spec.id);
  if (last && last.passed === false && last.finishedAt) {
    const retryAt = new Date(Date.parse(last.finishedAt) + cooldownHours * 3600_000);
    if (now < retryAt) {
      return { ok: false, reason: "Practise and teach a little more. Your next proof opens later.", retryAt: retryAt.toISOString() };
    }
  }
  return { ok: true };
}

/** Checks a proof run from scratch with src/core. Every reason it fails is listed. */
export function verifyProofRun(store: Store, entry: SkillEntry, run: ProofRunRow): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const rule = entry.spec.proofRule;
  if (!run.aiOff) reasons.push("AI was not off");
  if (run.version !== entry.spec.version) reasons.push("old skill version");
  if (run.skillId !== entry.spec.id) reasons.push("wrong skill");

  const deadline = Date.parse(run.startedAt) + PROOF_TIME_LIMIT_MINUTES * 60_000;
  const items = run.itemIds.map((id) => store.getItem(id));
  const formats = { solve: 0, apply: 0 };
  items.forEach((item, i) => {
    if (!item) return void reasons.push(`item ${i + 1} missing`);
    if (item.kind !== "proof" || item.runId !== run.id || item.studentId !== run.studentId || item.skillId !== run.skillId) {
      return void reasons.push(`item ${i + 1} does not belong to this run`);
    }
    formats[item.format]++;
    if (!paramsMatch(entry, item)) return void reasons.push(`item ${i + 1} does not match its seed`);
    const attempts = store.listAttemptsForItem(item.id);
    if (attempts.length !== 1) return void reasons.push(`item ${i + 1} not answered exactly once`);
    const typed = parseAnswer(attempts[0].answer);
    if (!typed.ok || !equals(typed.value, instanceFor(entry, item).answer)) reasons.push(`item ${i + 1} wrong`);
    if (Date.parse(attempts[0].createdAt) > deadline) reasons.push(`item ${i + 1} answered after ${PROOF_TIME_LIMIT_MINUTES} minutes`);
  });
  if (formats.solve !== rule.solve || formats.apply !== rule.apply) reasons.push("wrong mix of items");
  return { passed: rule.allCorrect && reasons.length === 0, reasons };
}

/** After a proof run is finished: KEY1 / NOT_YET → MASTERED if it passes, otherwise NOT_YET (KEY1 kept). */
export function recordProof(store: Store, studentId: string, entry: SkillEntry, runId: string, now: Date): MasteryState {
  const run = store.getProofRun(runId);
  if (!run || run.studentId !== studentId) throw new Error(`Proof run ${runId} not found for this student`);
  if (!run.finishedAt) throw new Error(`Proof run ${runId} is not finished`);
  const state = getState(store, studentId, entry);
  if (state !== "KEY1" && state !== "NOT_YET") return state;

  const verdict = verifyProofRun(store, entry, run);
  const evidence = readEvidence(store, studentId, entry.spec.id);
  if (verdict.passed) {
    return write(store, studentId, entry, "MASTERED", { ...evidence, proof: { runId, itemIds: run.itemIds, version: run.version } }, now);
  }
  const failedProofs = [...(evidence.failedProofs ?? []), { runId, version: run.version, reasons: verdict.reasons }];
  return write(store, studentId, entry, "NOT_YET", { ...evidence, failedProofs }, now);
}
