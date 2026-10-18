import { randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { parseAnswer } from "../core/answer";
import { diagnose } from "../core/diagnose";
import { equals, toString } from "../core/fraction";
import { createRng } from "../core/rng";
import type { ApplyItem } from "../core/skills/linear-both-sides-apply";
import { checkTeachStep, type TeachResult } from "../core/teach";
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

/** reason is English for logs and teachers; screens show their own translated words based on code (and errorKey). */
export type FailCode =
  | "locked"
  | "no_fresh"
  | "bad_answer"
  | "already_answered"
  | "already_fixed"
  | "no_tries"
  | "running"
  | "finished"
  | "not_ready"
  | "mastered"
  | "cooldown"
  | "wrong_codes"
  | "wrong_pin"
  | "locked_out"
  | "none";
type Fail = { ok: false; reason: string; code: FailCode; retryAt?: string; errorKey?: string };
const fail = (reason: string, code: FailCode, extra: Partial<Fail> = {}): Fail => ({ ok: false, reason, code, ...extra });

const STUDENT_CODE = /^[A-Z0-9]{1,8}-[0-9]{1,3}$/; // e.g. 8B-17 or KV8B-17
const CLASS_CODE = /^[A-Z0-9-]{1,16}$/;
const FRESH_TRIES = 50;
const STUCK_WINDOW_DAYS = 7;
const SMALL_SAMPLE = 30;
const UNKNOWN_LABEL = "Wrong answer that no known mistake explains yet";

const MAX_STUDENTS = 60;
const PIN_MAX_FAILURES = 10;
const PIN_LOCKOUT_MINUTES = 15;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

class NoFreshQuestion extends Error {}

function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

function pinMatches(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex ?? "", "hex");
  const given = scryptSync(pin, Buffer.from(saltHex ?? "", "hex"), 32);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const normaliseCode = (code: string) =>
  String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
const MASTERY_STATES = ["LOCKED", "OPEN", "KEY1", "NOT_YET", "MASTERED"] as const;

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

  /** Wrong-PIN times per class, for the lockout. Kept in memory: a restart clears it. */
  const pinFailures = new Map<string, number[]>();

  /** After a skill is MASTERED, open the skills that needed it. Returns the newly opened skill ids. */
  function unlockAfter(studentId: string, skillId: string): string[] {
    return Object.values(registry)
      .filter((e) => e.spec.prerequisites.includes(skillId))
      .filter((e) => {
        const before = mastery.getState(store, studentId, e);
        return before === "LOCKED" && mastery.refreshUnlock(store, studentId, e, now()) !== "LOCKED";
      })
      .map((e) => e.spec.id);
  }

  const deadlineOf = (run: ProofRunRow) => Date.parse(run.startedAt) + mastery.PROOF_TIME_LIMIT_MINUTES * 60_000;

  return {
    // ----- set-up (pseudonymous codes only) -----
    createClass(code: string, grade: number): ClassRow {
      if (!CLASS_CODE.test(code)) throw new Error("Class codes look like KV8B.");
      if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new Error("Grade must be 1 to 12.");
      const row: ClassRow = { id: randomUUID(), code, grade, section: "", aiAllowed: grade >= 8 };
      if (!store.insertClass(row)) throw new Error(`Class code ${code} is already taken.`);
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
      if (mastery.refreshUnlock(store, studentId, entry, now()) === "LOCKED") return fail("This skill is locked. Ask your teacher.", "locked");
      const served = serveFresh(studentId, entry, "practice", "solve");
      if (!served) return fail("Could not find a new question. Try again.", "no_fresh");
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
      if (!typed.ok) return fail(typed.error, "bad_answer", { errorKey: typed.errorKey });
      return store.transaction(() => {
        if (!store.markItemAnswered(item.id, iso())) return fail("This question was already answered.", "already_answered");
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
      if (mastery.refreshUnlock(store, studentId, entry, now()) === "LOCKED") return fail("This skill is locked. Ask your teacher.", "locked");
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
        if (e instanceof NoFreshQuestion) return fail("Could not find new questions. Try again.", "no_fresh");
        throw e;
      }
    },

    submitTeachStep(itemId: string, tappedLine: number, typedLine: string) {
      const item = requireItem(itemId, "teach");
      const entry = getEntry(registry, item.skillId);
      const { triesMax } = entry.spec.teachRule;
      return store.transaction(() => {
        const tries = store.listTeachTraces(item.id);
        if (tries.some((t) => t.lineCorrect && t.fixAccepted)) return fail("You already fixed this one.", "already_fixed");
        if (tries.length >= triesMax) return fail("No tries left for this one.", "no_tries");
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
        if (!saved) return fail("That try was already recorded.", "already_answered");
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
            if (now().getTime() <= deadlineOf(open)) return fail("A proof is already running.", "running");
            finishRun(open, entry); // abandoned: closed as not passed
          }
          const eligible = mastery.proofEligibility(store, studentId, entry, now(), cooldownHours);
          if (!eligible.ok) return fail(eligible.reason, eligible.code, { retryAt: eligible.retryAt });

          const runId = randomUUID();
          const startedAt = iso();
          if (!store.insertProofRun({ id: runId, studentId, skillId, version: entry.spec.version, itemIds: [], aiOff: true, startedAt })) {
            return fail("A proof is already running.", "running");
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
        if (e instanceof NoFreshQuestion) return fail("Could not find fresh questions. Try again.", "no_fresh");
        throw e;
      }
    },

    submitProofAnswer(
      itemId: string,
      answerText: string,
    ):
      | { ok: true; finished: false }
      | { ok: true; finished: true; passed: boolean; state: mastery.MasteryState; practise: string[]; unlocked: string[] }
      | Fail {
      const item = requireItem(itemId, "proof");
      const entry = getEntry(registry, item.skillId);
      const typed = parseAnswer(answerText);
      if (!typed.ok) return fail(typed.error, "bad_answer", { errorKey: typed.errorKey });
      return store.transaction(() => {
        const run = item.runId ? store.getProofRun(item.runId) : undefined;
        if (!run || run.finishedAt) return fail("This proof is already finished.", "finished");
        if (!store.markItemAnswered(item.id, iso())) return fail("This question was already answered.", "already_answered");
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
        if (!saved) return fail("This question was already answered.", "already_answered");
        if (mistakeId === "unknown") store.recordUnknownError(item.skillId, item.paramsJson, toString(typed.value));
        log(item.studentId, "proof_answered", { skillId: item.skillId, runId: run.id, itemId: item.id, correct });

        const allAnswered = store.listRunItems(run.id).every((i) => i.answeredAt);
        if (!allAnswered && now().getTime() <= deadlineOf(run)) return { ok: true as const, finished: false as const };
        const out = finishRun(store.getProofRun(run.id)!, entry);
        if (!out) return fail("This proof is already finished.", "finished");
        const practise = [
          ...new Set(
            store
              .listRunItems(run.id)
              .flatMap((i) => store.listAttemptsForItem(i.id))
              .filter((a) => !a.correct && a.mistakeId)
              .map((a) => a.mistakeId!),
          ),
        ];
        const unlocked = out.state === "MASTERED" ? unlockAfter(item.studentId, item.skillId) : [];
        return { ok: true as const, finished: true as const, ...out, practise, unlocked };
      });
    },

    /** The open (not expired) proof, so a child who reloads the page can carry on. */
    resumeProof(
      studentId: string,
      skillId: string,
    ):
      | {
          ok: true;
          runId: string;
          deadline: string;
          items: { itemId: string; format: ItemFormat; text: string; textHi?: string; answered: boolean }[];
        }
      | Fail {
      requireStudent(studentId);
      const entry = getEntry(registry, skillId);
      const open = store.getOpenProofRun(studentId, skillId);
      if (!open || now().getTime() > deadlineOf(open)) return fail("No proof is running.", "none");
      const items = open.itemIds.map((id) => {
        const item = store.getItem(id)!;
        const apply = item.format === "apply" ? entry.generateApply(createRng(item.seed)) : null;
        return {
          itemId: item.id,
          format: item.format,
          text: apply ? apply.text : instanceFor(entry, item).text,
          ...(apply ? { textHi: apply.textHi } : {}),
          answered: item.answeredAt !== null,
        };
      });
      return { ok: true, runId: open.id, deadline: new Date(deadlineOf(open)).toISOString(), items };
    },

    /** Can this child start a proof now? (An abandoned, expired proof is closed first.) */
    proofStatus(studentId: string, skillId: string): { canStart: true } | { canStart: false; code: FailCode; retryAt?: string } {
      requireStudent(studentId);
      const entry = getEntry(registry, skillId);
      return store.transaction(() => {
        mastery.refreshUnlock(store, studentId, entry, now());
        const open = store.getOpenProofRun(studentId, skillId);
        if (open) {
          if (now().getTime() <= deadlineOf(open)) return { canStart: false as const, code: "running" as const };
          finishRun(open, entry);
        }
        const eligible = mastery.proofEligibility(store, studentId, entry, now(), cooldownHours);
        if (eligible.ok) return { canStart: true as const };
        return { canStart: false as const, code: eligible.code, ...(eligible.retryAt ? { retryAt: eligible.retryAt } : {}) };
      });
    },

    // ----- classes, codes and logins (pseudonymous only: no names are ever entered) -----
    /** Creates a class with a class code, a 6-digit teacher PIN (shown once) and printable student codes. */
    createClassroom(input: { grade: number; section: string; studentCount: number; pin?: string }) {
      const grade = input.grade;
      const section = String(input.section ?? "").trim().toUpperCase();
      const count = input.studentCount;
      if (![7, 8, 9].includes(grade)) throw new Error("Grade must be 7, 8 or 9.");
      if (!/^[A-Z]$/.test(section)) throw new Error("Section must be one letter, like B.");
      if (!Number.isInteger(count) || count < 1 || count > MAX_STUDENTS) throw new Error(`Students must be 1 to ${MAX_STUDENTS}.`);
      const pin = input.pin ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
      if (!/^\d{6}$/.test(pin)) throw new Error("The PIN must be 6 digits.");
      const prefix = `${grade}${section}`;

      return store.transaction(() => {
        let cls: ClassRow | null = null;
        for (let i = 0; i < 20 && !cls; i++) {
          const suffix = Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join("");
          const candidate: ClassRow = { id: randomUUID(), code: `${prefix}-${suffix}`, grade, section, aiAllowed: grade >= 8 };
          if (store.insertClass(candidate, hashPin(pin))) cls = candidate;
        }
        if (!cls) throw new Error("Could not make a class code. Try again.");
        const studentCodes = Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}`);
        for (const code of studentCodes) store.insertStudent({ id: randomUUID(), classId: cls.id, code });
        log(null, "class_created", { classId: cls.id, grade, students: count, aiAllowed: cls.aiAllowed });
        return { classId: cls.id, classCode: cls.code, pin, studentCodes };
      });
    },

    verifyTeacherPin(classCode: string, pin: string): { ok: true; classId: string } | Fail {
      const cls = store.getClassByCode(normaliseCode(classCode));
      if (!cls) return fail("Wrong class code or PIN.", "wrong_pin");
      const cutoff = now().getTime() - PIN_LOCKOUT_MINUTES * 60_000;
      const recent = (pinFailures.get(cls.id) ?? []).filter((t) => t > cutoff);
      if (recent.length >= PIN_MAX_FAILURES) {
        log(null, "teacher_login", { classId: cls.id, ok: false, lockedOut: true });
        return fail(`Too many wrong PINs. Try again in ${PIN_LOCKOUT_MINUTES} minutes.`, "locked_out");
      }
      const ok = pinMatches(String(pin ?? "").trim(), store.getClassPinHash(cls.id));
      pinFailures.set(cls.id, ok ? [] : [...recent, now().getTime()]);
      log(null, "teacher_login", { classId: cls.id, ok });
      return ok ? { ok: true, classId: cls.id } : fail("Wrong class code or PIN.", "wrong_pin");
    },

    studentLogin(classCode: string, studentCode: string): { ok: true; studentId: string } | Fail {
      const cls = store.getClassByCode(normaliseCode(classCode));
      const student = cls && store.findStudentByCode(cls.id, normaliseCode(studentCode));
      if (!cls || !student) return fail("We could not find these codes.", "wrong_codes");
      log(student.id, "student_login", { classId: cls.id });
      return { ok: true, studentId: student.id };
    },

    getStudentContext(studentId: string) {
      const student = store.getStudent(studentId);
      const cls = student && store.getClass(student.classId);
      if (!student || !cls) return undefined;
      return {
        studentId: student.id,
        code: student.code,
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        aiAllowed: cls.aiAllowed,
      };
    },

    getClass: (classId: string) => store.getClass(classId),
    getClassByCode: (classCode: string) => store.getClassByCode(normaliseCode(classCode)),
    listStudentCodes: (classId: string) => store.listStudents(classId).map((s) => s.code),
    getItemOwner: (itemId: string) => store.getItem(itemId)?.studentId,

    /** Every skill, in teaching order, with this child's state. */
    getSkillMap(studentId: string) {
      requireStudent(studentId);
      return Object.values(registry).map((e) => ({ skillId: e.spec.id, state: mastery.refreshUnlock(store, studentId, e, now()) }));
    },

    /** Opens a skill for every student in the class. Returns how many were newly opened. */
    teacherUnlockClass(classId: string, skillId: string): number {
      if (!store.getClass(classId)) throw new Error(`Unknown class: ${classId}`);
      const entry = getEntry(registry, skillId);
      let opened = 0;
      store.transaction(() => {
        for (const s of store.listStudents(classId)) {
          if (mastery.getState(store, s.id, entry) !== "LOCKED") continue;
          if (mastery.teacherUnlock(store, s.id, entry, now()) === "OPEN") opened++;
        }
      });
      log(null, "teacher_unlock_class", { classId, skillId, opened });
      return opened;
    },

    /** How many students are in each state, per skill. */
    getClassProgress(classId: string) {
      if (!store.getClass(classId)) throw new Error(`Unknown class: ${classId}`);
      const students = store.listStudents(classId);
      return Object.values(registry).map((e) => {
        const counts = Object.fromEntries(MASTERY_STATES.map((s) => [s, 0])) as Record<(typeof MASTERY_STATES)[number], number>;
        for (const s of students) counts[mastery.refreshUnlock(store, s.id, e, now())]++;
        return { skillId: e.spec.id, counts };
      });
    },

    // ----- projector (class mode: no student accounts, never touches mastery) -----
    projectorTrace(classId: string, skillId: string) {
      if (!store.getClass(classId)) throw new Error(`Unknown class: ${classId}`);
      const { spec } = getEntry(registry, skillId);
      const seed = newSeed();
      const instance = spec.generate(createRng(seed));
      const mistake = spec.mistakes[Math.floor(random() * spec.mistakes.length)];
      log(null, "projector_trace", { classId, skillId, mistakeId: mistake.id });
      return { seed, mistakeId: mistake.id, question: instance.text, lines: mistake.apply(instance).trace.map((l) => l.text) };
    },

    projectorCheck(
      classId: string,
      skillId: string,
      seed: number,
      mistakeId: string,
      tappedLine: number,
      typedLine: string,
    ): TeachResult {
      if (!store.getClass(classId)) throw new Error(`Unknown class: ${classId}`);
      const { spec } = getEntry(registry, skillId);
      if (!Number.isInteger(seed) || !spec.mistakes.some((m) => m.id === mistakeId)) throw new Error("Bad projector item");
      const result = checkTeachStep(spec.generate(createRng(seed)), mistakeId, tappedLine, String(typedLine ?? ""));
      log(null, "projector_step", { classId, skillId, mistakeId, lineCorrect: result.lineCorrect, fixAccepted: result.fixAccepted });
      return result;
    },

    // ----- mined mistakes (the Misconception Miner will add drafts; teachers decide) -----
    listPendingMinedMistakes() {
      return store.listMinedMistakes("draft").map(({ id, skillId, createdAt }) => ({ id, skillId, createdAt }));
    },

    decideMinedMistake(classId: string, id: string, decision: "approved" | "rejected"): boolean {
      const cls = store.getClass(classId);
      if (!cls) throw new Error(`Unknown class: ${classId}`);
      const done = store.decideMinedMistake(id, decision, `teacher of class ${cls.code}`);
      log(null, "mined_mistake_decided", { classId, id, decision, done });
      return done;
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
