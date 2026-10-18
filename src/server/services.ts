import { randomInt, randomUUID } from "node:crypto";
import { parseAnswer } from "../core/answer";
import { diagnose } from "../core/diagnose";
import { equals, toString } from "../core/fraction";
import { createRng } from "../core/rng";
import type { ApplyItem } from "../core/skills/linear-both-sides-apply";
import { checkTeachStep } from "../core/teach";
import type { Instance } from "../core/types";
import * as mastery from "./mastery";
import { defaultRegistry, getEntry, instanceFor, type Registry, type SkillEntry } from "./skills";
import type { ClassRow, ItemFormat, ItemKind, ItemRow, ProofRunRow, Store, StudentRow } from "./store";

// Session services: what the student and teacher screens call. Correct answers and mistake answers come only
// from src/core; mastery changes only through src/server/mastery.ts. Every action logs an event row.

export type ServiceOptions = {
  registry?: Registry;
  now?: () => Date;
  /** Seeds for new questions (tests pass a fixed sequence). */
  newSeed?: () => number;
  /** Random number in [0, 1) used to shuffle mistakes. */
  random?: () => number;
  /** Overrides PROOF_COOLDOWN_HOURS. */
  cooldownHours?: number;
};

type Fail = { ok: false; reason: string; retryAt?: string };
const fail = (reason: string): Fail => ({ ok: false, reason });

const STUDENT_CODE = /^[A-Z0-9]{1,8}-[0-9]{1,3}$/; // e.g. 8B-17 or KV8B-17
const CLASS_CODE = /^[A-Z0-9-]{1,16}$/;
const FRESH_TRIES = 50;
const STUCK_WINDOW_DAYS = 7;
const SMALL_SAMPLE = 30;
const UNKNOWN_LABEL = "Wrong answer that no known mistake explains yet";

class NoFreshQuestion extends Error {}

export function createServices(store: Store, opts: ServiceOptions = {}) {
  const registry = opts.registry ?? defaultRegistry;
  const now = opts.now ?? (() => new Date());
  const newSeed = opts.newSeed ?? (() => randomInt(1, 2 ** 31 - 1));
  const random = opts.random ?? (() => randomInt(0, 2 ** 32) / 2 ** 32);
  const cooldownHours = opts.cooldownHours ?? mastery.proofCooldownHours();
  const iso = () => now().toISOString();
  const log = (studentId: string | null, type: string, payload: unknown) => store.logEvent(studentId, type, payload, iso());

  function requireStudent(studentId: string): StudentRow {
    const s = store.getStudent(studentId);
    if (!s) throw new Error(`Unknown student: ${studentId}`);
    return s;
  }

  function requireItem(itemId: string, kind: ItemKind): ItemRow {
    const item = store.getItem(itemId);
    if (!item || item.kind !== kind) throw new Error(`Unknown ${kind} item: ${itemId}`);
    return item;
  }

  /** Stores a question this child has never seen (and, for proofs, one no child has had). Null if none found. */
  function serveFresh(
    studentId: string,
    entry: SkillEntry,
    kind: ItemKind,
    format: ItemFormat,
    extra: { runId?: string; mistakeId?: string } = {},
  ): { item: ItemRow; instance: Instance; apply: ApplyItem | null } | null {
    const seen = new Set(store.listItems({ studentId, skillId: entry.spec.id }).map((i) => i.paramsJson));
    for (let i = 0; i < FRESH_TRIES; i++) {
      const seed = newSeed();
      const apply = format === "apply" ? entry.generateApply(createRng(seed)) : null;
      const instance = apply ? apply.instance : entry.spec.generate(createRng(seed));
      const paramsJson = JSON.stringify(instance.params);
      if (seen.has(paramsJson)) continue;
      const item: ItemRow = {
        id: randomUUID(),
        studentId,
        skillId: entry.spec.id,
        version: entry.spec.version,
        seed,
        kind,
        format,
        runId: extra.runId ?? null,
        mistakeId: extra.mistakeId ?? null,
        paramsJson,
        answer: toString(instance.answer),
        servedAt: iso(),
        answeredAt: null,
      };
      if (store.insertItem(item)) return { item, instance, apply };
    }
    return null;
  }

  function shuffled<T>(xs: T[]): T[] {
    const out = [...xs];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Closes a proof run, then lets the mastery engine decide. */
  function finishRun(run: ProofRunRow, entry: SkillEntry) {
    const verdict = mastery.verifyProofRun(store, entry, run);
    if (!store.finishProofRun(run.id, verdict.passed, iso())) return null;
    log(run.studentId, "proof_finished", { skillId: run.skillId, runId: run.id, passed: verdict.passed });
    const state = mastery.recordProof(store, run.studentId, entry, run.id, now());
    return { passed: verdict.passed, state };
  }

  const deadlineOf = (run: ProofRunRow) => Date.parse(run.startedAt) + mastery.PROOF_TIME_LIMIT_MINUTES * 60_000;

  return {
    // ----- set-up (pseudonymous codes only) -----
    createClass(code: string, grade: number): ClassRow {
      if (!CLASS_CODE.test(code)) throw new Error("Class codes look like KV8B.");
      if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new Error("Grade must be 1 to 12.");
      const row: ClassRow = { id: randomUUID(), code, grade, aiAllowed: grade >= 8 };
      store.insertClass(row);
      log(null, "class_created", { classId: row.id, grade, aiAllowed: row.aiAllowed });
      return row;
    },

    createStudent(classId: string, code: string): StudentRow {
      if (!STUDENT_CODE.test(code)) throw new Error("Student codes look like 8B-17. Never use names.");
      if (!store.getClass(classId)) throw new Error(`Unknown class: ${classId}`);
      const row: StudentRow = { id: randomUUID(), classId, code };
      store.insertStudent(row);
      log(row.id, "student_created", { classId });
      return row;
    },

    teacherUnlock(studentId: string, skillId: string) {
      requireStudent(studentId);
      const state = mastery.teacherUnlock(store, studentId, getEntry(registry, skillId), now());
      log(studentId, "teacher_unlock", { skillId });
      return state;
    },

    getState(studentId: string, skillId: string) {
      requireStudent(studentId);
      return mastery.refreshUnlock(store, studentId, getEntry(registry, skillId), now());
    },

    // ----- practise -----
    servePracticeItem(studentId: string, skillId: string): { ok: true; itemId: string; text: string } | Fail {
      requireStudent(studentId);
      const entry = getEntry(registry, skillId);
      if (mastery.refreshUnlock(store, studentId, entry, now()) === "LOCKED") return fail("This skill is locked. Ask your teacher.");
      const served = serveFresh(studentId, entry, "practice", "solve");
      if (!served) return fail("Could not find a new question. Try again.");
      log(studentId, "practice_served", { skillId, itemId: served.item.id });
      return { ok: true, itemId: served.item.id, text: served.instance.text };
    },

    submitPracticeAnswer(
      itemId: string,
      answerText: string,
    ): { ok: true; correct: boolean; mistakeId: string | null; feedback: string } | Fail {
      const item = requireItem(itemId, "practice");
      const entry = getEntry(registry, item.skillId);
      const typed = parseAnswer(answerText);
      if (!typed.ok) return fail(typed.error);
      return store.transaction(() => {
        if (!store.markItemAnswered(item.id, iso())) return fail("This question was already answered.");
        const instance = instanceFor(entry, item);
        const correct = equals(typed.value, instance.answer);
        const mistakeId = correct ? null : diagnose(entry.spec, instance, typed.value);
        store.insertAttempt({
          id: randomUUID(),
          studentId: item.studentId,
          itemId: item.id,
          answer: toString(typed.value),
          correct,
          mistakeId,
          createdAt: iso(),
        });
        if (mistakeId === "unknown") store.recordUnknownError(item.skillId, item.paramsJson, toString(typed.value));
        log(item.studentId, "practice_answered", { skillId: item.skillId, itemId: item.id, correct, mistakeId });
        const feedback = correct
          ? "Correct! Both sides are equal for your answer."
          : (entry.spec.mistakes.find((m) => m.id === mistakeId)?.childLabel ?? entry.spec.hintLadder[0]);
        return { ok: true as const, correct, mistakeId, feedback };
      });
    },

    // ----- teach the Shishya -----
    startTeach(
      studentId: string,
      skillId: string,
    ): { ok: true; sessionId: string; traces: { itemId: string; question: string; lines: string[] }[] } | Fail {
      requireStudent(studentId);
      const entry = getEntry(registry, skillId);
      if (mastery.refreshUnlock(store, studentId, entry, now()) === "LOCKED") return fail("This skill is locked. Ask your teacher.");
      const { traces, distinctMistakesMin } = entry.spec.teachRule;
      const mistakes = shuffled(entry.spec.mistakes);
      if (new Set(mistakes.slice(0, traces).map((m) => m.id)).size < distinctMistakesMin) {
        throw new Error(`${skillId} needs at least ${distinctMistakesMin} mistakes to teach`);
      }
      const sessionId = randomUUID();
      try {
        const out = store.transaction(() =>
          Array.from({ length: traces }, (_, i) => {
            const mistake = mistakes[i % mistakes.length];
            const served = serveFresh(studentId, entry, "teach", "solve", { runId: sessionId, mistakeId: mistake.id });
            if (!served) throw new NoFreshQuestion();
            return {
              itemId: served.item.id,
              question: served.instance.text,
              lines: mistake.apply(served.instance).trace.map((l) => l.text),
              mistakeId: mistake.id,
            };
          }),
        );
        log(studentId, "teach_started", { skillId, sessionId, mistakeIds: out.map((t) => t.mistakeId) });
        return { ok: true, sessionId, traces: out.map(({ itemId, question, lines }) => ({ itemId, question, lines })) };
      } catch (e) {
        if (e instanceof NoFreshQuestion) return fail("Could not find new questions. Try again.");
        throw e;
      }
    },

    submitTeachStep(itemId: string, tappedLine: number, typedLine: string) {
      const item = requireItem(itemId, "teach");
      const entry = getEntry(registry, item.skillId);
      const { triesMax } = entry.spec.teachRule;
      return store.transaction(() => {
        const tries = store.listTeachTraces(item.id);
        if (tries.some((t) => t.lineCorrect && t.fixAccepted)) return fail("You already fixed this one.");
        if (tries.length >= triesMax) return fail("No tries left for this one. Go on to the next.");
        const result = checkTeachStep(instanceFor(entry, item), item.mistakeId!, tappedLine, typedLine);
        const tryNumber = tries.length + 1;
        const saved = store.insertTeachTrace({
          id: randomUUID(),
          studentId: item.studentId,
          itemId: item.id,
          mistakeId: item.mistakeId!,
          tryNumber,
          tappedLine,
          typedLine,
          lineCorrect: result.lineCorrect,
          fixAccepted: result.fixAccepted,
          createdAt: iso(),
        });
        if (!saved) return fail("That try was already recorded.");
        log(item.studentId, "teach_step", {
          skillId: item.skillId,
          itemId: item.id,
          tryNumber,
          lineCorrect: result.lineCorrect,
          fixAccepted: result.fixAccepted,
        });
        const state = mastery.evaluateTeach(store, item.studentId, entry, now());
        return { ok: true as const, ...result, triesLeft: triesMax - tryNumber, state };
      });
    },

    // ----- prove it (AI off) -----
    startProof(studentId: string, skillId: string):
      | {
          ok: true;
          runId: string;
          aiOff: true;
          deadline: string;
          items: { itemId: string; format: ItemFormat; text: string; textHi?: string }[];
        }
      | Fail {
      requireStudent(studentId);
      const entry = getEntry(registry, skillId);
      try {
        return store.transaction(() => {
          mastery.refreshUnlock(store, studentId, entry, now());
          const open = store.getOpenProofRun(studentId, skillId);
          if (open) {
            if (now().getTime() <= deadlineOf(open)) return fail("A proof is already running.");
            finishRun(open, entry); // abandoned: closed as not passed
          }
          const eligible = mastery.proofEligibility(store, studentId, entry, now(), cooldownHours);
          if (!eligible.ok) return eligible;

          const runId = randomUUID();
          const startedAt = iso();
          if (!store.insertProofRun({ id: runId, studentId, skillId, version: entry.spec.version, itemIds: [], aiOff: true, startedAt })) {
            return fail("A proof is already running.");
          }
          const { solve, apply } = entry.spec.proofRule;
          const formats: ItemFormat[] = [...Array<ItemFormat>(solve).fill("solve"), ...Array<ItemFormat>(apply).fill("apply")];
          const served = formats.map((format) => {
            const s = serveFresh(studentId, entry, "proof", format, { runId });
            if (!s) throw new NoFreshQuestion();
            return s;
          });
          store.setProofRunItems(runId, served.map((s) => s.item.id));
          log(studentId, "proof_started", { skillId, runId, aiOff: true });
          return {
            ok: true as const,
            runId,
            aiOff: true as const,
            deadline: new Date(Date.parse(startedAt) + mastery.PROOF_TIME_LIMIT_MINUTES * 60_000).toISOString(),
            items: served.map((s) => ({
              itemId: s.item.id,
              format: s.item.format,
              text: s.apply ? s.apply.text : s.instance.text,
              ...(s.apply ? { textHi: s.apply.textHi } : {}),
            })),
          };
        });
      } catch (e) {
        if (e instanceof NoFreshQuestion) return fail("Could not find fresh questions. Try again.");
        throw e;
      }
    },

    submitProofAnswer(
      itemId: string,
      answerText: string,
    ): { ok: true; finished: false } | { ok: true; finished: true; passed: boolean; state: mastery.MasteryState } | Fail {
      const item = requireItem(itemId, "proof");
      const entry = getEntry(registry, item.skillId);
      const typed = parseAnswer(answerText);
      if (!typed.ok) return fail(typed.error);
      return store.transaction(() => {
        const run = item.runId ? store.getProofRun(item.runId) : undefined;
        if (!run || run.finishedAt) return fail("This proof is already finished.");
        if (!store.markItemAnswered(item.id, iso())) return fail("This question was already answered.");
        const instance = instanceFor(entry, item);
        const correct = equals(typed.value, instance.answer);
        const mistakeId = correct ? null : diagnose(entry.spec, instance, typed.value);
        const saved = store.insertAttempt({
          id: randomUUID(),
          studentId: item.studentId,
          itemId: item.id,
          answer: toString(typed.value),
          correct,
          mistakeId,
          createdAt: iso(),
        });
        if (!saved) return fail("This question was already answered.");
        if (mistakeId === "unknown") store.recordUnknownError(item.skillId, item.paramsJson, toString(typed.value));
        log(item.studentId, "proof_answered", { skillId: item.skillId, runId: run.id, itemId: item.id, correct });

        const allAnswered = store.listRunItems(run.id).every((i) => i.answeredAt);
        if (!allAnswered && now().getTime() <= deadlineOf(run)) return { ok: true as const, finished: false as const };
        const out = finishRun(store.getProofRun(run.id)!, entry);
        if (!out) return fail("This proof is already finished.");
        return { ok: true as const, finished: true as const, ...out };
      });
    },

    // ----- teacher -----
    /** Students grouped by their most frequent mistake in the last 7 days (ties: the most recent one). */
    getStuckBoard(classId: string) {
      if (!store.getClass(classId)) throw new Error(`Unknown class: ${classId}`);
      const since = new Date(now().getTime() - STUCK_WINDOW_DAYS * 86_400_000).toISOString();
      const hits = store.listClassMistakesSince(classId, since);

      const perStudent = new Map<string, { code: string; tally: Map<string, { count: number; last: number }> }>();
      hits.forEach((h, order) => {
        const s = perStudent.get(h.studentId) ?? { code: h.code, tally: new Map() };
        const key = `${h.skillId}|${h.mistakeId}`;
        const t = s.tally.get(key) ?? { count: 0, last: 0 };
        s.tally.set(key, { count: t.count + 1, last: order });
        perStudent.set(h.studentId, s);
      });

      const groups = new Map<string, { skillId: string; mistakeId: string; label: string; studentCodes: string[] }>();
      for (const { code, tally } of perStudent.values()) {
        const [top] = [...tally.entries()].sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)[0];
        const [skillId, mistakeId] = top.split("|");
        const label =
          mistakeId === "unknown"
            ? UNKNOWN_LABEL
            : (registry[skillId]?.spec.mistakes.find((m) => m.id === mistakeId)?.label ?? mistakeId);
        const g = groups.get(top) ?? { skillId, mistakeId, label, studentCodes: [] };
        g.studentCodes.push(code);
        groups.set(top, g);
      }
      log(null, "stuck_board_viewed", { classId });
      return [...groups.values()]
        .map((g) => ({ ...g, count: g.studentCodes.length, studentCodes: g.studentCodes.sort() }))
        .sort(
          (a, b) =>
            Number(a.mistakeId === "unknown") - Number(b.mistakeId === "unknown") ||
            b.count - a.count ||
            `${a.skillId}|${a.mistakeId}`.localeCompare(`${b.skillId}|${b.mistakeId}`),
        );
    },

    /** Anonymous counts only: no student codes, ids or class codes. */
    exportPilotCsv(classId: string): string {
      const cls = store.getClass(classId);
      if (!cls) throw new Error(`Unknown class: ${classId}`);
      const students = store.countStudents(classId);
      const header = [
        "grade",
        "skillId",
        "students",
        "practiceAnswers",
        "practiceCorrect",
        "unknownWrongAnswers",
        "teachTries",
        "teachFixes",
        "proofRuns",
        "proofsPassed",
        "studentsKey1",
        "studentsMastered",
        "note",
      ];
      const rows = store.exportCounts(classId).map((c) =>
        [
          cls.grade,
          c.skillId,
          students,
          c.practiceAnswers,
          c.practiceCorrect,
          c.unknownWrongAnswers,
          c.teachTries,
          c.teachFixes,
          c.proofRuns,
          c.proofsPassed,
          c.studentsKey1,
          c.studentsMastered,
          students < SMALL_SAMPLE ? "small sample" : "",
        ].join(","),
      );
      log(null, "pilot_export", { classId, rows: rows.length });
      return [header.join(","), ...rows].join("\n") + "\n";
    },
  };
}

export type Services = ReturnType<typeof createServices>;
