import { parseAnswerFor, sameAnswer } from "../core/answer";
import { checkTeachStep } from "../core/teach";
import { defaultRegistry, getEntry, instanceFor, type Registry, type SkillEntry } from "./skills";
import type { AttemptRow, EventInput, ItemRow, MasteryRow, MasteryState, ProofRunRow, Store } from "./store";

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
  /** A made-up child's state in a Judge Tour (sandbox) class, written by seedSandboxMastery. */
  seeded?: { by: "judge tour" };
};

/** PROOF_COOLDOWN_HOURS: hours between a failed proof and the next one. Default 24; 0 allowed for demos. */
export function proofCooldownHours(env: Record<string, string | undefined> = process.env): number {
  const raw = env.PROOF_COOLDOWN_HOURS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_PROOF_COOLDOWN_HOURS;
  const hours = Number(raw);
  return Number.isFinite(hours) && hours >= 0 ? hours : DEFAULT_PROOF_COOLDOWN_HOURS;
}

const evidenceOf = (row: MasteryRow | undefined): Evidence => (row ? (JSON.parse(row.evidenceJson) as Evidence) : {});

/** The state a stored row means. KEY1 / NOT_YET earned on an older skill version count as OPEN (teach again). */
function stateOf(row: MasteryRow | undefined, entry: SkillEntry): MasteryState {
  if (!row) return "LOCKED";
  if ((row.state === "KEY1" || row.state === "NOT_YET") && row.version !== entry.spec.version) return "OPEN";
  return row.state;
}

/** The current state. */
export async function getState(store: Store, studentId: string, entry: SkillEntry): Promise<MasteryState> {
  return stateOf(await store.getMastery(studentId, entry.spec.id), entry);
}

/** A state change: the new row and its event log line, written together by store.writeMastery. */
type Change = { row: MasteryRow; event: EventInput };

function change(studentId: string, entry: SkillEntry, from: MasteryState, to: MasteryState, evidence: Evidence, now: Date): Change {
  const at = now.toISOString();
  return {
    row: { studentId, skillId: entry.spec.id, state: to, evidenceJson: JSON.stringify(evidence), version: entry.spec.version, updatedAt: at },
    event: { studentId, type: "mastery_changed", payload: { skillId: entry.spec.id, version: entry.spec.version, from, to, evidence }, at },
  };
}

/** Writes changes (rows and log lines) in one round trip, all or nothing. */
async function write(store: Store, changes: Change[]): Promise<void> {
  if (changes.length) await store.writeMastery(changes.map((c) => c.row), changes.map((c) => c.event));
}

const key = (studentId: string, skillId: string) => `${studentId}|${skillId}`;

/**
 * LOCKED → OPEN for every (student, skill) whose prerequisites are all MASTERED (a skill with none opens at once).
 * Works from mastery rows read ONCE (`rows`: all rows of these students), so a class needs one read, not one per
 * student per skill. Returns each student's state per skill.
 */
export async function refreshUnlockMany(
  store: Store,
  studentIds: string[],
  rows: MasteryRow[],
  entries: SkillEntry[],
  now: Date,
): Promise<Map<string, Map<string, MasteryState>>> {
  const byKey = new Map(rows.map((r) => [key(r.studentId, r.skillId), r]));
  const out = new Map<string, Map<string, MasteryState>>();
  const changes: Change[] = [];
  for (const studentId of studentIds) {
    const states = new Map<string, MasteryState>();
    for (const entry of entries) {
      const row = byKey.get(key(studentId, entry.spec.id));
      let state = stateOf(row, entry);
      const prerequisites = entry.spec.prerequisites;
      if (state === "LOCKED" && prerequisites.every((p) => byKey.get(key(studentId, p))?.state === "MASTERED")) {
        changes.push(change(studentId, entry, state, "OPEN", { ...evidenceOf(row), unlock: { by: "prerequisites", prerequisites } }, now));
        state = "OPEN";
      }
      states.set(entry.spec.id, state);
    }
    out.set(studentId, states);
  }
  await write(store, changes);
  return out;
}

/** LOCKED → OPEN when every prerequisite is MASTERED (one student, one skill). */
export async function refreshUnlock(store: Store, studentId: string, entry: SkillEntry, now: Date): Promise<MasteryState> {
  const states = await refreshUnlockMany(store, [studentId], await store.listMastery({ studentId }), [entry], now);
  return states.get(studentId)!.get(entry.spec.id)!;
}

/** LOCKED → OPEN because the teacher says so, for many students (`rows`: their mastery rows). Returns how many opened. */
export async function teacherUnlockMany(store: Store, studentIds: string[], rows: MasteryRow[], entry: SkillEntry, now: Date): Promise<number> {
  const byKey = new Map(rows.map((r) => [key(r.studentId, r.skillId), r]));
  const changes = studentIds
    .map((id) => ({ id, row: byKey.get(key(id, entry.spec.id)) }))
    .filter(({ row }) => stateOf(row, entry) === "LOCKED")
    .map(({ id, row }) => change(id, entry, "LOCKED", "OPEN", { ...evidenceOf(row), unlock: { by: "teacher" } }, now));
  await write(store, changes);
  return changes.length;
}

/** LOCKED → OPEN because the teacher says so (one student). */
export async function teacherUnlock(store: Store, studentId: string, entry: SkillEntry, now: Date): Promise<MasteryState> {
  const row = await store.getMastery(studentId, entry.spec.id);
  await teacherUnlockMany(store, [studentId], row ? [row] : [], entry, now);
  const state = stateOf(row, entry);
  return state === "LOCKED" ? "OPEN" : state;
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
  const current = await store.getMastery(studentId, entry.spec.id);
  const state = stateOf(current, entry);
  if (state !== "OPEN") return state;
  const items = await store.listItems({ studentId, skillId: entry.spec.id, kind: "teach", version: entry.spec.version });
  const sessions = new Map<string, ItemRow[]>();
  for (const item of items) if (item.runId) sessions.set(item.runId, [...(sessions.get(item.runId) ?? []), item]);

  for (const [sessionId, sessionItems] of sessions) {
    const traceIds = await qualifyingTraceIds(store, entry, sessionItems);
    if (!traceIds) continue;
    const evidence: Evidence = {
      ...evidenceOf(current),
      key1: { sessionId, itemIds: sessionItems.map((i) => i.id), traceIds, version: entry.spec.version },
    };
    await write(store, [change(studentId, entry, state, "KEY1", evidence, now)]);
    return "KEY1";
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
  const items = new Map((await store.getItems(run.itemIds)).map((i) => [i.id, i]));
  const attemptsOf = new Map<string, AttemptRow[]>();
  for (const a of await store.listAttemptsForItems(run.itemIds)) attemptsOf.set(a.itemId, [...(attemptsOf.get(a.itemId) ?? []), a]);
  for (const [i, id] of run.itemIds.entries()) {
    const item = items.get(id);
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
    const attempts = attemptsOf.get(item.id) ?? [];
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

/** One made-up child's state for one skill in a Judge Tour class (a proof run, if given, must be a real passed run). */
export type SandboxSeed = { studentId: string; skillId: string; state: MasteryState; proof?: { runId: string; itemIds: string[] } };

/**
 * ONLY for Judge Tour (sandbox) classes: writes the made-up children's states in one batch, marked as seeded, with
 * one log line. Refuses any class that is not a sandbox, and any student who is not in that class. Real and test
 * classes can never get a state this way. Returns how many rows it wrote (a LOCKED state needs no row).
 */
export async function seedSandboxMastery(
  store: Store,
  classId: string,
  seeds: SandboxSeed[],
  now: Date,
  registry: Registry = defaultRegistry,
): Promise<number> {
  const [cls, students] = await Promise.all([store.getClass(classId), store.listStudents(classId)]);
  if (!cls || cls.kind !== "sandbox") throw new Error("Mastery can be seeded only in a sandbox (Judge Tour) class");
  const inClass = new Set(students.map((s) => s.id));
  const outsider = seeds.find((s) => !inClass.has(s.studentId));
  if (outsider) throw new Error(`Student ${outsider.studentId} is not in this sandbox class`);
  const at = now.toISOString();
  const rows: MasteryRow[] = seeds
    .filter((s) => s.state !== "LOCKED")
    .map((s) => {
      const { version } = getEntry(registry, s.skillId).spec;
      const evidence: Evidence = { seeded: { by: "judge tour" }, ...(s.proof ? { proof: { ...s.proof, version } } : {}) };
      return { studentId: s.studentId, skillId: s.skillId, state: s.state, evidenceJson: JSON.stringify(evidence), version, updatedAt: at };
    });
  await store.writeMastery(rows, [{ studentId: null, type: "tour_mastery_seeded", payload: { classId, rows: rows.length }, at }]);
  return rows.length;
}

/** After a proof run is finished: KEY1 / NOT_YET → MASTERED if it passes, otherwise NOT_YET (KEY1 kept). */
export async function recordProof(store: Store, studentId: string, entry: SkillEntry, runId: string, now: Date): Promise<MasteryState> {
  const run = await store.getProofRun(runId);
  if (!run || run.studentId !== studentId) throw new Error(`Proof run ${runId} not found for this student`);
  if (!run.finishedAt) throw new Error(`Proof run ${runId} is not finished`);
  const current = await store.getMastery(studentId, entry.spec.id);
  const state = stateOf(current, entry);
  if (state !== "KEY1" && state !== "NOT_YET") return state;

  const verdict = await verifyProofRun(store, entry, run);
  const evidence = evidenceOf(current);
  if (verdict.passed) {
    await write(store, [change(studentId, entry, state, "MASTERED", { ...evidence, proof: { runId, itemIds: run.itemIds, version: run.version } }, now)]);
    return "MASTERED";
  }
  const failedProofs = [...(evidence.failedProofs ?? []), { runId, version: run.version, reasons: verdict.reasons }];
  await write(store, [change(studentId, entry, state, "NOT_YET", { ...evidence, failedProofs }, now)]);
  return "NOT_YET";
}
