import { randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { answerText, parseAnswerFor, sameAnswer } from "../core/answer";
import { diagnose } from "../core/diagnose";
import { createRng } from "../core/rng";
import type { ApplyItem } from "../core/skills/linear-both-sides-apply";
import { validateMinedMistake, type MinedMistakeSpec } from "../core/minedMistake";
import { checkTeachStep, type TeachResult } from "../core/teach";
import { applies, type Instance } from "../core/types";
import * as mastery from "./mastery";
import { minedMistakes, unknownErrors } from "./miner-ports";
import { defaultRegistry, getEntry, instanceFor, type Registry, type SkillEntry } from "./skills";
import type { ClassRow, ItemFormat, ItemKind, ItemRow, MistakeHitRow, ProofRunRow, Store, StudentRow } from "./store";

// Session services: what the student and teacher screens call. Correct answers and mistake answers come only
// from src/core; mastery changes only through src/server/mastery.ts. Every action logs an event row.
// Every function is async because the store is (libSQL: a local file or a cloud database).
// Teacher-approved mined mistakes join each skill's mistake list (diagnosis, Teach, stuck board). They are data
// checked by src/core; they never decide mastery.

export type ServiceOptions = {
  registry?: Registry;
  now?: () => Date;
  /** Seeds for new questions (tests pass a fixed sequence). */
  newSeed?: () => number;
  /** Random number in [0, 1) used to shuffle mistakes. */
  random?: () => number;
  /** Overrides PROOF_COOLDOWN_HOURS. */
  cooldownHours?: number;
  /** Throws (a SetupError) if a server setting is missing; run before creating a class, so nothing is half-written. */
  checkSetup?: () => void;
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
  | "window_closed"
  | "none";
type Fail = { ok: false; reason: string; code: FailCode; retryAt?: string; errorKey?: string };
const fail = (reason: string, code: FailCode, extra: Partial<Fail> = {}): Fail => ({ ok: false, reason, code, ...extra });

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
/** e.g. 8B-K7QM (random, made now), or the older 8B-17 / KV8B-17 (in order), which keep working. */
const STUDENT_CODE = new RegExp(`^[A-Z0-9]{1,8}-([0-9]{1,3}|[${CODE_ALPHABET}]{4})$`);
const CLASS_CODE = /^[A-Z0-9-]{1,16}$/;
const FRESH_TRIES = 50;
const STUCK_WINDOW_DAYS = 7;
/** A child shows a mistake PATTERN only when the same mistake explained their answers on this many different questions; one is a slip. */
export const PATTERN_MIN_QUESTIONS = 2;
/** Columns of the stuck board's grid: the working line where a pattern first goes wrong (L1 is the question). */
const GRID_LINES = [2, 3, 4, 5];
const SMALL_SAMPLE = 30;
const UNKNOWN_LABEL = "Wrong answer that no known mistake explains yet";

const MAX_STUDENTS = 60;
// Failed log-ins are counted from the events table, so every server instance sees the same count.
const PIN_MAX_FAILURES = 5;
const PIN_LOCKOUT_MINUTES = 15;
const LOGIN_MAX_FAILURES = 30; // wrong student codes per class code (a class of 40 mistypes)
const LOGIN_LOCKOUT_MINUTES = 10;
const PROOF_WINDOW_MINUTES = 15;

class NoFreshQuestion extends Error {}

const randomSuffix = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join("");

/** count random student codes like 8B-K7QM, all different and none in avoid. */
function randomStudentCodes(prefix: string, count: number, avoid: Set<string> = new Set()): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    const code = `${prefix}-${randomSuffix()}`;
    if (!avoid.has(code)) codes.add(code);
  }
  return [...codes];
}

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

type ProofItemView = { itemId: string; format: ItemFormat; text: string; textHi?: string };

export function createServices(store: Store, opts: ServiceOptions = {}) {
  const registry = opts.registry ?? defaultRegistry;
  const now = opts.now ?? (() => new Date());
  const newSeed = opts.newSeed ?? (() => randomInt(1, 2 ** 31 - 1));
  const random = opts.random ?? (() => randomInt(0, 2 ** 32) / 2 ** 32);
  const cooldownHours = opts.cooldownHours ?? mastery.proofCooldownHours();
  const iso = () => now().toISOString();
  const log = (studentId: string | null, type: string, payload: unknown) => store.logEvent(studentId, type, payload, iso());

  async function requireStudent(studentId: string): Promise<StudentRow> {
    const s = await store.getStudent(studentId);
    if (!s) throw new Error(`Unknown student: ${studentId}`);
    return s;
  }

  async function requireItem(itemId: string, kind: ItemKind): Promise<ItemRow> {
    const item = await store.getItem(itemId);
    if (!item || item.kind !== kind) throw new Error(`Unknown ${kind} item: ${itemId}`);
    return item;
  }

  async function requireClass(classId: string): Promise<ClassRow> {
    const cls = await store.getClass(classId);
    if (!cls) throw new Error(`Unknown class: ${classId}`);
    return cls;
  }

  /** Stores a question this child has never seen (and, for proofs, one no child has had). Null if none found. */
  async function serveFresh(
    studentId: string,
    entry: SkillEntry,
    kind: ItemKind,
    format: ItemFormat,
    extra: { runId?: string; mistakeId?: string; accept?: (instance: Instance) => boolean } = {},
  ): Promise<{ item: ItemRow; instance: Instance; apply: ApplyItem | null } | null> {
    const seen = new Set((await store.listItems({ studentId, skillId: entry.spec.id })).map((i) => i.paramsJson));
    const tries = extra.accept ? FRESH_TRIES * 6 : FRESH_TRIES; // a mistake may apply to only some questions
    for (let i = 0; i < tries; i++) {
      const seed = newSeed();
      const apply = format === "apply" ? entry.generateApply(createRng(seed)) : null;
      const instance = apply ? apply.instance : entry.spec.generate(createRng(seed));
      const paramsJson = JSON.stringify(instance.params);
      if (seen.has(paramsJson) || (extra.accept && !extra.accept(instance))) continue;
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
        answer: answerText(instance.answer),
        servedAt: iso(),
        answeredAt: null,
      };
      if (await store.insertItem(item)) return { item, instance, apply };
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
  async function finishRun(run: ProofRunRow, entry: SkillEntry) {
    const verdict = await mastery.verifyProofRun(store, entry, run);
    if (!(await store.finishProofRun(run.id, verdict.passed, iso()))) return null;
    await log(run.studentId, "proof_finished", { skillId: run.skillId, runId: run.id, passed: verdict.passed });
    const state = await mastery.recordProof(store, run.studentId, entry, run.id, now());
    return { passed: verdict.passed, state };
  }

  const minutesAgo = (m: number) => new Date(now().getTime() - m * 60_000).toISOString();

  /** The teacher's proof window: whether this class needs one, until when it is open, and the minutes left (0 when closed). */
  function proofWindowOf(cls: ClassRow) {
    const left = cls.proofWindowOpenUntil ? Date.parse(cls.proofWindowOpenUntil) - now().getTime() : 0;
    return { required: cls.proofWindowRequired, openUntil: cls.proofWindowOpenUntil, minutesLeft: Math.max(0, Math.ceil(left / 60_000)) };
  }

  /** False when the child's class needs the teacher to open the proof window and it is not open now. */
  async function proofWindowOpen(student: StudentRow): Promise<boolean> {
    const cls = await requireClass(student.classId);
    return !cls.proofWindowRequired || proofWindowOf(cls).minutesLeft > 0;
  }
  const windowClosed = () => fail("Your teacher opens the proof in class.", "window_closed");

  /** After a skill is MASTERED, open the skills that needed it. Returns the newly opened skill ids. */
  async function unlockAfter(studentId: string, skillId: string): Promise<string[]> {
    const next = Object.values(registry).filter((e) => e.spec.prerequisites.includes(skillId));
    if (next.length === 0) return [];
    const rows = await store.listMastery({ studentId });
    const before = new Set(rows.map((r) => r.skillId));
    const states = (await mastery.refreshUnlockMany(store, [studentId], rows, next, now())).get(studentId)!;
    return next.filter((e) => !before.has(e.spec.id) && states.get(e.spec.id) !== "LOCKED").map((e) => e.spec.id);
  }

  /** Tested drafts waiting for a teacher, with the mistake data and the validator's report. */
  async function pendingMined() {
    const parse = <T>(text: string): T | null => {
      try {
        return JSON.parse(text) as T;
      } catch {
        return null;
      }
    };
    return (await store.listMinedMistakes("DRAFT_TESTED")).map((r) => ({
      id: r.id,
      skillId: r.skillId,
      createdAt: r.createdAt,
      spec: parse<MinedMistakeSpec>(r.source),
      report: parse<{ reproduced: number; checkedInstances: number; overlaps: Record<string, number> }>(r.testsJson),
    }));
  }

  /** Each student's state for every skill, from one read of the class's mastery rows (opening skills whose prerequisites are mastered). */
  async function classStates(classId: string, students: StudentRow[]) {
    const rows = await store.listMastery({ classId });
    return mastery.refreshUnlockMany(store, students.map((s) => s.id), rows, Object.values(registry), now());
  }

  function progressFrom(students: StudentRow[], states: Map<string, Map<string, mastery.MasteryState>>) {
    return Object.values(registry).map((e) => {
      const counts = Object.fromEntries(MASTERY_STATES.map((s) => [s, 0])) as Record<(typeof MASTERY_STATES)[number], number>;
      for (const s of students) counts[states.get(s.id)!.get(e.spec.id)!]++;
      return { skillId: e.spec.id, counts };
    });
  }

  const windowStart = () => new Date(now().getTime() - STUCK_WINDOW_DAYS * 86_400_000).toISOString();

  /** The working line where this mistake first goes wrong on that question (L1 is the question), or null if unknown. */
  async function wrongLineOf(skillId: string, mistakeId: string, item: { seed: number; format: ItemFormat }): Promise<number | null> {
    if (!registry[skillId]) return null;
    const entry = await entryOf(skillId);
    const mistake = entry.spec.mistakes.find((m) => m.id === mistakeId);
    return mistake ? mistake.apply(instanceFor(entry, item)).firstWrongLine : null;
  }

  /**
   * The stuck board for the last 7 days, from one read of the class's wrong answers.
   * groups: a child is in a mistake group only when that mistake explained their answers on at least
   * PATTERN_MIN_QUESTIONS different questions (their biggest such pattern; ties: the most recent), or, with no
   * pattern, when their most frequent wrong answers are ones no known mistake explains ("unknown").
   * slips: children whose top known mistake matched only one question (watched, not labelled).
   * grid: per skill, how many children's patterns first go wrong at each working line.
   */
  async function stuckGroups(classId: string) {
    const hits = await store.listClassMistakesSince(classId, windowStart());

    type Tally = { skillId: string; mistakeId: string; questions: Set<string>; last: number; lastHit: MistakeHitRow };
    const perStudent = new Map<string, { code: string; tally: Map<string, Tally> }>();
    hits.forEach((h, order) => {
      const s = perStudent.get(h.studentId) ?? { code: h.code, tally: new Map() };
      const key = `${h.skillId}|${h.mistakeId}`;
      const t = s.tally.get(key) ?? { skillId: h.skillId, mistakeId: h.mistakeId, questions: new Set<string>(), last: 0, lastHit: h };
      t.questions.add(h.paramsJson); // two items with the same params are one question
      s.tally.set(key, { ...t, last: order, lastHit: h });
      perStudent.set(h.studentId, s);
    });

    type Evidence = { code: string; questions: number; line: number | null };
    const groups = new Map<string, { skillId: string; mistakeId: string; label: string; students: Evidence[] }>();
    const slips = new Map<string, { code: string; line: number | null }[]>();
    const byEvidence = (a: Tally, b: Tally) => b.questions.size - a.questions.size || b.last - a.last;
    for (const { code, tally } of perStudent.values()) {
      const all = [...tally.values()];
      const patterns = all.filter((t) => t.mistakeId !== "unknown" && t.questions.size >= PATTERN_MIN_QUESTIONS);
      const top = (patterns.length ? patterns : all).sort(byEvidence)[0];
      const { skillId, mistakeId } = top;
      const line = mistakeId === "unknown" ? null : await wrongLineOf(skillId, mistakeId, top.lastHit);
      if (mistakeId !== "unknown" && top.questions.size < PATTERN_MIN_QUESTIONS) {
        slips.set(skillId, [...(slips.get(skillId) ?? []), { code, line }]);
        continue;
      }
      const key = `${skillId}|${mistakeId}`;
      const label = mistakeId === "unknown" ? UNKNOWN_LABEL : ((await labelOf(skillId, mistakeId)) ?? mistakeId);
      const g = groups.get(key) ?? { skillId, mistakeId, label, students: [] };
      g.students.push({ code, questions: top.questions.size, line });
      groups.set(key, g);
    }
    await log(null, "stuck_board_viewed", { classId });

    const byCode = <T extends { code: string }>(xs: T[]) => xs.sort((a, b) => a.code.localeCompare(b.code));
    const groupList = [...groups.values()]
      .map((g) => {
        const students = byCode(g.students);
        return { ...g, students, count: students.length, studentCodes: students.map((x) => x.code) };
      })
      .sort(
        (a, b) =>
          Number(a.mistakeId === "unknown") - Number(b.mistakeId === "unknown") ||
          b.count - a.count ||
          `${a.skillId}|${a.mistakeId}`.localeCompare(`${b.skillId}|${b.mistakeId}`),
      );
    const skillOrder = Object.keys(registry);
    const slipList = [...slips.entries()]
      .sort(([a], [b]) => skillOrder.indexOf(a) - skillOrder.indexOf(b) || a.localeCompare(b))
      .map(([skillId, students]) => ({ skillId, students: byCode(students) }));
    // a line past the last column is counted in the last one (no skill has one today)
    const column = (line: number) => Math.min(Math.max(line, GRID_LINES[0]), GRID_LINES[GRID_LINES.length - 1]);
    const grid = {
      lines: GRID_LINES,
      rows: skillOrder.map((skillId) => {
        const lines = groupList
          .filter((g) => g.skillId === skillId && g.mistakeId !== "unknown")
          .flatMap((g) => g.students.map((x) => x.line))
          .filter((x): x is number => x !== null);
        return { skillId, counts: GRID_LINES.map((l) => lines.filter((x) => column(x) === l).length) };
      }),
    };
    return { groups: groupList, slips: slipList, grid };
  }

  const deadlineOf = (run: ProofRunRow) => Date.parse(run.startedAt) + mastery.PROOF_TIME_LIMIT_MINUTES * 60_000;

  /** Approved mined mistakes per skill, reloaded at most once a minute (and at once after a teacher decides). */
  const minedCache = new Map<string, { at: number; entry: SkillEntry }>();
  const MINED_CACHE_MS = 60_000;

  /** A skill with its authored mistakes plus the teacher-approved mined ones. */
  async function entryOf(skillId: string): Promise<SkillEntry> {
    const base = getEntry(registry, skillId);
    const cached = minedCache.get(skillId);
    if (cached && Date.now() - cached.at < MINED_CACHE_MS) return cached.entry;
    const mined = await minedMistakes(store, base.spec, ["APPROVED"]);
    const entry = mined.length ? { ...base, spec: { ...base.spec, mistakes: [...base.spec.mistakes, ...mined] } } : base;
    minedCache.set(skillId, { at: Date.now(), entry });
    return entry;
  }

  async function labelOf(skillId: string, mistakeId: string): Promise<string | undefined> {
    if (!registry[skillId]) return undefined;
    return (await entryOf(skillId)).spec.mistakes.find((m) => m.id === mistakeId)?.label;
  }

  return {
    // ----- set-up (pseudonymous codes only) -----
    async createClass(code: string, grade: number): Promise<ClassRow> {
      if (!CLASS_CODE.test(code)) throw new Error("Class codes look like KV8B.");
      if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new Error("Grade must be 1 to 12.");
      // the older set-up path (tests and scripts): no proof window, like classes made before windows existed
      const row: ClassRow = {
        id: randomUUID(),
        code,
        grade,
        section: "",
        aiAllowed: grade >= 8,
        proofWindowRequired: false,
        proofWindowOpenUntil: null,
      };
      if (!(await store.insertClass(row))) throw new Error(`Class code ${code} is already taken.`);
      await log(null, "class_created", { classId: row.id, grade, aiAllowed: row.aiAllowed });
      return row;
    },

    async createStudent(classId: string, code: string): Promise<StudentRow> {
      if (!STUDENT_CODE.test(code)) throw new Error("Student codes look like 8B-K7QM. Never use names.");
      await requireClass(classId);
      const row: StudentRow = { id: randomUUID(), classId, code };
      await store.insertStudent(row);
      await log(row.id, "student_created", { classId });
      return row;
    },

    async teacherUnlock(studentId: string, skillId: string) {
      await requireStudent(studentId);
      const state = await mastery.teacherUnlock(store, studentId, getEntry(registry, skillId), now());
      await log(studentId, "teacher_unlock", { skillId });
      return state;
    },

    async getState(studentId: string, skillId: string) {
      await requireStudent(studentId);
      return mastery.refreshUnlock(store, studentId, getEntry(registry, skillId), now());
    },

    // ----- practise -----
    async servePracticeItem(studentId: string, skillId: string): Promise<{ ok: true; itemId: string; text: string } | Fail> {
      await requireStudent(studentId);
      const entry = await entryOf(skillId);
      if ((await mastery.refreshUnlock(store, studentId, entry, now())) === "LOCKED") {
        return fail("This skill is locked. Ask your teacher.", "locked");
      }
      const served = await serveFresh(studentId, entry, "practice", "solve");
      if (!served) return fail("Could not find a new question. Try again.", "no_fresh");
      await log(studentId, "practice_served", { skillId, itemId: served.item.id });
      return { ok: true, itemId: served.item.id, text: served.instance.text };
    },

    async submitPracticeAnswer(
      itemId: string,
      typedText: string,
    ): Promise<{ ok: true; correct: boolean; mistakeId: string | null; checkLine: number | null; feedback: string } | Fail> {
      const item = await requireItem(itemId, "practice");
      const entry = await entryOf(item.skillId);
      const typed = parseAnswerFor(entry.spec.answerKind, typedText);
      if (!typed.ok) return fail(typed.error, "bad_answer", { errorKey: typed.errorKey });
      return store.transaction(async () => {
        if (!(await store.markItemAnswered(item.id, iso()))) return fail("This question was already answered.", "already_answered");
        const instance = instanceFor(entry, item);
        const correct = sameAnswer(typed.value, instance.answer);
        const mistakeId = correct ? null : diagnose(entry.spec, instance, typed.value);
        await store.insertAttempt({
          id: randomUUID(),
          studentId: item.studentId,
          itemId: item.id,
          answer: answerText(typed.value),
          correct,
          mistakeId,
          createdAt: iso(),
        });
        if (mistakeId === "unknown") await store.recordUnknownError(item.skillId, item.paramsJson, answerText(typed.value));
        await log(item.studentId, "practice_answered", { skillId: item.skillId, itemId: item.id, correct, mistakeId });
        // A first match may be a slip: point to the line only; name the mistake from the 2nd different question on.
        const mistake = entry.spec.mistakes.find((m) => m.id === mistakeId);
        let checkLine: number | null = null;
        if (mistake) {
          const before = await store.countMistakeQuestionsSince({
            studentId: item.studentId,
            skillId: item.skillId,
            mistakeId: mistake.id,
            since: windowStart(),
            exceptParamsJson: item.paramsJson,
          });
          if (before + 1 < PATTERN_MIN_QUESTIONS) checkLine = mistake.apply(instance).firstWrongLine;
        }
        const feedback = correct
          ? "Correct! Both sides are equal for your answer."
          : checkLine !== null
            ? `Check line ${checkLine} again.`
            : (mistake?.childLabel ?? entry.spec.hintLadder[0]);
        // the child is told only what the server decided to show: no mistake id for a first match
        return { ok: true as const, correct, mistakeId: checkLine === null ? mistakeId : null, checkLine, feedback };
      });
    },

    // ----- teach the Shishya -----
    async startTeach(
      studentId: string,
      skillId: string,
    ): Promise<{ ok: true; sessionId: string; traces: { itemId: string; question: string; lines: string[] }[] } | Fail> {
      await requireStudent(studentId);
      const entry = await entryOf(skillId);
      if ((await mastery.refreshUnlock(store, studentId, entry, now())) === "LOCKED") {
        return fail("This skill is locked. Ask your teacher.", "locked");
      }
      const { traces, distinctMistakesMin } = entry.spec.teachRule;
      const mistakes = shuffled(entry.spec.mistakes);
      if (new Set(mistakes.slice(0, traces).map((m) => m.id)).size < distinctMistakesMin) {
        throw new Error(`${skillId} needs at least ${distinctMistakesMin} mistakes to teach`);
      }
      const sessionId = randomUUID();
      try {
        const out = await store.transaction(async () => {
          const list = [];
          for (let i = 0; i < traces; i++) {
            const mistake = mistakes[i % mistakes.length];
            const served = await serveFresh(studentId, entry, "teach", "solve", {
              runId: sessionId,
              mistakeId: mistake.id,
              accept: (instance) => applies(mistake, instance), // a question this mistake makes sense for
            });
            if (!served) throw new NoFreshQuestion();
            list.push({
              itemId: served.item.id,
              question: served.instance.text,
              lines: mistake.apply(served.instance).trace.map((l) => l.text),
              mistakeId: mistake.id,
            });
          }
          return list;
        });
        await log(studentId, "teach_started", { skillId, sessionId, mistakeIds: out.map((t) => t.mistakeId) });
        return { ok: true, sessionId, traces: out.map(({ itemId, question, lines }) => ({ itemId, question, lines })) };
      } catch (e) {
        if (e instanceof NoFreshQuestion) return fail("Could not find new questions. Try again.", "no_fresh");
        throw e;
      }
    },

    async submitTeachStep(itemId: string, tappedLine: number, typedLine: string) {
      const item = await requireItem(itemId, "teach");
      const entry = await entryOf(item.skillId);
      const { triesMax } = entry.spec.teachRule;
      return store.transaction(async () => {
        const tries = await store.listTeachTraces(item.id);
        if (tries.some((t) => t.lineCorrect && t.fixAccepted)) return fail("You already fixed this one.", "already_fixed");
        if (tries.length >= triesMax) return fail("No tries left for this one.", "no_tries");
        const result = checkTeachStep(instanceFor(entry, item), item.mistakeId!, tappedLine, typedLine, entry.spec.mistakes);
        const tryNumber = tries.length + 1;
        const saved = await store.insertTeachTrace({
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
        await log(item.studentId, "teach_step", {
          skillId: item.skillId,
          itemId: item.id,
          tryNumber,
          lineCorrect: result.lineCorrect,
          fixAccepted: result.fixAccepted,
        });
        const state = await mastery.evaluateTeach(store, item.studentId, entry, now());
        return { ok: true as const, ...result, triesLeft: triesMax - tryNumber, state };
      });
    },

    // ----- prove it (AI off) -----
    async startProof(
      studentId: string,
      skillId: string,
    ): Promise<{ ok: true; runId: string; aiOff: true; deadline: string; items: ProofItemView[] } | Fail> {
      const student = await requireStudent(studentId);
      const entry = await entryOf(skillId);
      try {
        return await store.transaction(async () => {
          await mastery.refreshUnlock(store, studentId, entry, now());
          const open = await store.getOpenProofRun(studentId, skillId);
          if (open) {
            if (now().getTime() <= deadlineOf(open)) return fail("A proof is already running.", "running");
            await finishRun(open, entry); // abandoned: closed as not passed
          }
          const eligible = await mastery.proofEligibility(store, studentId, entry, now(), cooldownHours);
          if (!eligible.ok) return fail(eligible.reason, eligible.code, { retryAt: eligible.retryAt });
          // a proof starts only while the teacher has the window open; once started it keeps its own 30 minutes
          if (!(await proofWindowOpen(student))) return windowClosed();

          const runId = randomUUID();
          const startedAt = iso();
          const inserted = await store.insertProofRun({
            id: runId,
            studentId,
            skillId,
            version: entry.spec.version,
            itemIds: [],
            aiOff: true,
            startedAt,
          });
          if (!inserted) return fail("A proof is already running.", "running");
          const { solve, apply } = entry.spec.proofRule;
          const formats: ItemFormat[] = [...Array<ItemFormat>(solve).fill("solve"), ...Array<ItemFormat>(apply).fill("apply")];
          const served = [];
          for (const format of formats) {
            const s = await serveFresh(studentId, entry, "proof", format, { runId });
            if (!s) throw new NoFreshQuestion();
            served.push(s);
          }
          await store.setProofRunItems(runId, served.map((s) => s.item.id));
          await log(studentId, "proof_started", { skillId, runId, aiOff: true });
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

    async submitProofAnswer(
      itemId: string,
      typedText: string,
    ): Promise<
      | { ok: true; finished: false }
      | { ok: true; finished: true; passed: boolean; state: mastery.MasteryState; practise: string[]; unlocked: string[] }
      | Fail
    > {
      const item = await requireItem(itemId, "proof");
      const entry = await entryOf(item.skillId);
      const typed = parseAnswerFor(entry.spec.answerKind, typedText);
      if (!typed.ok) return fail(typed.error, "bad_answer", { errorKey: typed.errorKey });
      return store.transaction(async () => {
        const run = item.runId ? await store.getProofRun(item.runId) : undefined;
        if (!run || run.finishedAt) return fail("This proof is already finished.", "finished");
        if (!(await store.markItemAnswered(item.id, iso()))) return fail("This question was already answered.", "already_answered");
        const instance = instanceFor(entry, item);
        const correct = sameAnswer(typed.value, instance.answer);
        const mistakeId = correct ? null : diagnose(entry.spec, instance, typed.value);
        const saved = await store.insertAttempt({
          id: randomUUID(),
          studentId: item.studentId,
          itemId: item.id,
          answer: answerText(typed.value),
          correct,
          mistakeId,
          createdAt: iso(),
        });
        if (!saved) return fail("This question was already answered.", "already_answered");
        if (mistakeId === "unknown") await store.recordUnknownError(item.skillId, item.paramsJson, answerText(typed.value));
        await log(item.studentId, "proof_answered", { skillId: item.skillId, runId: run.id, itemId: item.id, correct });

        const runItems = await store.listRunItems(run.id);
        const allAnswered = runItems.every((i) => i.answeredAt);
        if (!allAnswered && now().getTime() <= deadlineOf(run)) return { ok: true as const, finished: false as const };
        const out = await finishRun((await store.getProofRun(run.id))!, entry);
        if (!out) return fail("This proof is already finished.", "finished");
        const wrong: string[] = [];
        for (const a of await store.listAttemptsForItems(runItems.map((i) => i.id))) if (!a.correct && a.mistakeId) wrong.push(a.mistakeId);
        const unlocked = out.state === "MASTERED" ? await unlockAfter(item.studentId, item.skillId) : [];
        return { ok: true as const, finished: true as const, ...out, practise: [...new Set(wrong)], unlocked };
      });
    },

    /** The open (not expired) proof, so a child who reloads the page can carry on. */
    async resumeProof(
      studentId: string,
      skillId: string,
    ): Promise<{ ok: true; runId: string; deadline: string; items: (ProofItemView & { answered: boolean })[] } | Fail> {
      await requireStudent(studentId);
      const entry = await entryOf(skillId);
      const open = await store.getOpenProofRun(studentId, skillId);
      if (!open || now().getTime() > deadlineOf(open)) return fail("No proof is running.", "none");
      const items = [];
      for (const id of open.itemIds) {
        const item = (await store.getItem(id))!;
        const apply = item.format === "apply" ? entry.generateApply(createRng(item.seed)) : null;
        items.push({
          itemId: item.id,
          format: item.format,
          text: apply ? apply.text : instanceFor(entry, item).text,
          ...(apply ? { textHi: apply.textHi } : {}),
          answered: item.answeredAt !== null,
        });
      }
      return { ok: true, runId: open.id, deadline: new Date(deadlineOf(open)).toISOString(), items };
    },

    /** Can this child start a proof now? (An abandoned, expired proof is closed first.) */
    async proofStatus(studentId: string, skillId: string): Promise<{ canStart: true } | { canStart: false; code: FailCode; retryAt?: string }> {
      const student = await requireStudent(studentId);
      const entry = await entryOf(skillId);
      return store.transaction(async () => {
        await mastery.refreshUnlock(store, studentId, entry, now());
        const open = await store.getOpenProofRun(studentId, skillId);
        if (open) {
          if (now().getTime() <= deadlineOf(open)) return { canStart: false as const, code: "running" as const };
          await finishRun(open, entry);
        }
        const eligible = await mastery.proofEligibility(store, studentId, entry, now(), cooldownHours);
        if (eligible.ok && !(await proofWindowOpen(student))) return { canStart: false as const, code: "window_closed" as const };
        if (eligible.ok) return { canStart: true as const };
        return { canStart: false as const, code: eligible.code, ...(eligible.retryAt ? { retryAt: eligible.retryAt } : {}) };
      });
    },

    // ----- classes, codes and logins (pseudonymous only: no names are ever entered) -----
    /** Creates a class with a class code, a 6-digit teacher PIN (shown once) and printable student codes. */
    async createClassroom(input: { grade: number; section: string; studentCount: number; pin?: string }) {
      const grade = input.grade;
      const section = String(input.section ?? "").trim().toUpperCase();
      const count = input.studentCount;
      if (![7, 8, 9].includes(grade)) throw new Error("Grade must be 7, 8 or 9.");
      if (!/^[A-Z]$/.test(section)) throw new Error("Section must be one letter, like B.");
      if (!Number.isInteger(count) || count < 1 || count > MAX_STUDENTS) throw new Error(`Students must be 1 to ${MAX_STUDENTS}.`);
      const pin = input.pin ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
      if (!/^\d{6}$/.test(pin)) throw new Error("The PIN must be 6 digits.");
      opts.checkSetup?.(); // e.g. no SESSION_SECRET: the teacher could never be given the class, so write nothing
      const prefix = `${grade}${section}`;

      // the class, its PIN hash and every student code are written together or not at all
      return store.transaction(async () => {
        let cls: ClassRow | null = null;
        for (let i = 0; i < 20 && !cls; i++) {
          const candidate: ClassRow = {
            id: randomUUID(),
            code: `${prefix}-${randomSuffix()}`,
            grade,
            section,
            aiAllowed: grade >= 8,
            proofWindowRequired: true,
            proofWindowOpenUntil: null,
          };
          if (await store.insertClass(candidate, hashPin(pin))) cls = candidate;
        }
        if (!cls) throw new Error("Could not make a class code. Try again.");
        // random, so knowing the class code and one child's code does not give a classmate's
        const studentCodes = randomStudentCodes(prefix, count).sort();
        for (const code of studentCodes) await store.insertStudent({ id: randomUUID(), classId: cls.id, code });
        await log(null, "class_created", { classId: cls.id, grade, students: count, aiAllowed: cls.aiAllowed });
        return { classId: cls.id, classCode: cls.code, pin, studentCodes };
      });
    },

    async verifyTeacherPin(classCode: string, pin: string): Promise<{ ok: true; classId: string } | Fail> {
      const found = await store.getClassWithPinHashByCode(normaliseCode(classCode), minutesAgo(PIN_LOCKOUT_MINUTES));
      if (!found) return fail("Wrong class code or PIN.", "wrong_pin");
      const { cls, pinHash, recentFailures } = found;
      if (recentFailures >= PIN_MAX_FAILURES) {
        await log(null, "teacher_login", { classId: cls.id, ok: false, lockedOut: true });
        return fail(`Too many wrong PINs. Try again in ${PIN_LOCKOUT_MINUTES} minutes.`, "locked_out");
      }
      const ok = pinMatches(String(pin ?? "").trim(), pinHash);
      await log(null, "teacher_login", { classId: cls.id, ok });
      return ok ? { ok: true, classId: cls.id } : fail("Wrong class code or PIN.", "wrong_pin");
    },

    /** After LOGIN_MAX_FAILURES wrong student codes for a class in LOGIN_LOCKOUT_MINUTES, even a right one waits. No codes are logged. */
    async studentLogin(classCode: string, studentCode: string): Promise<{ ok: true; studentId: string } | Fail> {
      const found = await store.findLogin(normaliseCode(classCode), normaliseCode(studentCode), minutesAgo(LOGIN_LOCKOUT_MINUTES));
      if (!found) {
        await log(null, "student_login", { classId: null, ok: false });
        return fail("We could not find these codes.", "wrong_codes");
      }
      const { cls, student, recentFailures } = found;
      if (recentFailures >= LOGIN_MAX_FAILURES) {
        await log(null, "student_login", { classId: cls.id, ok: false, lockedOut: true });
        return fail(`Too many wrong codes. Try again in ${LOGIN_LOCKOUT_MINUTES} minutes.`, "locked_out");
      }
      await log(student?.id ?? null, "student_login", { classId: cls.id, ok: Boolean(student) });
      return student ? { ok: true, studentId: student.id } : fail("We could not find these codes.", "wrong_codes");
    },

    /** Replaces every student's code in the class with a new random one. Ids, mastery and history stay. Returns the new codes. */
    async reissueStudentCodes(classId: string): Promise<string[]> {
      const cls = await requireClass(classId);
      const students = await store.listStudents(classId);
      // never one of the old codes, so no child can log in as another during or after the change
      const codes = randomStudentCodes(`${cls.grade}${cls.section}`, students.length, new Set(students.map((s) => s.code)));
      const event = { studentId: null, type: "codes_reissued", payload: { classId, students: students.length }, at: iso() };
      await store.setStudentCodes(classId, students.map((s, i) => ({ id: s.id, code: codes[i] })), event);
      return [...codes].sort();
    },

    /** Lets this class start proofs for the next PROOF_WINDOW_MINUTES (a proof already started keeps its own time). */
    async openProofWindow(classId: string): Promise<{ openUntil: string }> {
      await requireClass(classId);
      const openUntil = new Date(now().getTime() + PROOF_WINDOW_MINUTES * 60_000).toISOString();
      await store.setProofWindow(classId, openUntil);
      await log(null, "proof_window_opened", { classId, minutes: PROOF_WINDOW_MINUTES });
      return { openUntil };
    },

    async closeProofWindow(classId: string) {
      await requireClass(classId);
      await store.setProofWindow(classId, null);
      await log(null, "proof_window_closed", { classId });
    },

    async getStudentContext(studentId: string) {
      const student = await store.getStudent(studentId);
      const cls = student && (await store.getClass(student.classId));
      if (!student || !cls) return undefined;
      return {
        studentId: student.id,
        code: student.code,
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        aiAllowed: cls.aiAllowed,
        proofWindowRequired: cls.proofWindowRequired,
      };
    },

    getClass: (classId: string) => store.getClass(classId),
    getClassByCode: (classCode: string) => store.getClassByCode(normaliseCode(classCode)),
    listStudentCodes: async (classId: string) => (await store.listStudents(classId)).map((s) => s.code),
    getItemOwner: async (itemId: string) => (await store.getItem(itemId))?.studentId,

    /** Every skill, in teaching order, with this child's state. */
    async getSkillMap(studentId: string) {
      await requireStudent(studentId);
      const entries = Object.values(registry);
      const rows = await store.listMastery({ studentId });
      const states = (await mastery.refreshUnlockMany(store, [studentId], rows, entries, now())).get(studentId)!;
      return entries.map((e) => ({ skillId: e.spec.id, state: states.get(e.spec.id)! }));
    },

    /** Opens a skill for every student in the class. Returns how many were newly opened. */
    async teacherUnlockClass(classId: string, skillId: string): Promise<number> {
      await requireClass(classId);
      const entry = await entryOf(skillId);
      const opened = await store.transaction(async () => {
        const students = await store.listStudents(classId);
        const rows = await store.listMastery({ classId });
        return mastery.teacherUnlockMany(store, students.map((s) => s.id), rows, entry, now());
      });
      await log(null, "teacher_unlock_class", { classId, skillId, opened });
      return opened;
    },

    /** How many students are in each state, per skill. */
    async getClassProgress(classId: string) {
      await requireClass(classId);
      const students = await store.listStudents(classId);
      return progressFrom(students, await classStates(classId, students));
    },

    /** Everything the class board shows, reading the class and its students once (reads run side by side). */
    async getClassBoard(classId: string) {
      const cls = await requireClass(classId);
      const [students, mined] = await Promise.all([store.listStudents(classId), pendingMined()]);
      const [states, stuck] = await Promise.all([classStates(classId, students), stuckGroups(classId)]);
      return { stuck, progress: progressFrom(students, states), mined, codes: students.map((s) => s.code), proofWindow: proofWindowOf(cls) };
    },

    // ----- projector (class mode: no student accounts, never touches mastery) -----
    async projectorTrace(classId: string, skillId: string) {
      await requireClass(classId);
      const { spec } = await entryOf(skillId);
      let seed = newSeed();
      let instance = spec.generate(createRng(seed));
      let possible = spec.mistakes.filter((m) => applies(m, instance));
      for (let i = 0; i < FRESH_TRIES && possible.length === 0; i++) {
        seed = newSeed();
        instance = spec.generate(createRng(seed));
        possible = spec.mistakes.filter((m) => applies(m, instance));
      }
      if (possible.length === 0) throw new Error(`${skillId}: no question with a mistake that applies`);
      const mistake = possible[Math.floor(random() * possible.length)];
      await log(null, "projector_trace", { classId, skillId, mistakeId: mistake.id });
      return { seed, mistakeId: mistake.id, question: instance.text, lines: mistake.apply(instance).trace.map((l) => l.text) };
    },

    async projectorCheck(
      classId: string,
      skillId: string,
      seed: number,
      mistakeId: string,
      tappedLine: number,
      typedLine: string,
    ): Promise<TeachResult> {
      await requireClass(classId);
      const { spec } = await entryOf(skillId);
      if (!Number.isInteger(seed) || !spec.mistakes.some((m) => m.id === mistakeId)) throw new Error("Bad projector item");
      const result = checkTeachStep(spec.generate(createRng(seed)), mistakeId, tappedLine, String(typedLine ?? ""), spec.mistakes);
      await log(null, "projector_step", { classId, skillId, mistakeId, lineCorrect: result.lineCorrect, fixAccepted: result.fixAccepted });
      return result;
    },

    // ----- mined mistakes (the Misconception Miner adds tested drafts; teachers decide) -----
    /** Tested drafts waiting for a teacher, with the mistake data and the validator's report. */
    listPendingMinedMistakes: () => pendingMined(),

    /**
     * Approve (only if it still passes the validator) or reject a tested draft. On approval the teacher may rewrite
     * the label and the child message (never the formulas); the edited JSON is checked again and saved.
     */
    async decideMinedMistake(
      classId: string,
      id: string,
      decision: "approved" | "rejected",
      edits?: { label?: string; childLabel?: string },
    ): Promise<{ ok: true } | { ok: false; reason: string }> {
      const cls = await requireClass(classId);
      const row = await store.getMinedMistake(id);
      if (!row || row.status !== "DRAFT_TESTED") return { ok: false, reason: "This is not a draft waiting for review." };
      let edited = false;
      let newSource: string | undefined;
      if (decision === "approved") {
        const base = registry[row.skillId];
        if (!base) return { ok: false, reason: "Unknown skill." };
        let spec: Record<string, unknown>;
        try {
          spec = JSON.parse(row.source) as Record<string, unknown>;
        } catch {
          return { ok: false, reason: "The draft could not be read." };
        }
        const label = edits?.label?.trim();
        const childLabel = edits?.childLabel?.trim();
        edited = (label !== undefined && label !== spec.label) || (childLabel !== undefined && childLabel !== spec.childLabel);
        if (edited) {
          spec = { ...spec, ...(label !== undefined ? { label } : {}), ...(childLabel !== undefined ? { childLabel } : {}) };
          newSource = JSON.stringify(spec);
        }
        const existing = [...base.spec.mistakes, ...(await minedMistakes(store, base.spec, ["APPROVED"]))];
        const report = validateMinedMistake(spec, { skill: base.spec, unknownErrors: await unknownErrors(store, row.skillId), existing });
        if (!report.ok) return { ok: false, reason: `It no longer passes the checks: ${report.errors.join("; ")}` };
      }
      const approver = `teacher of class ${cls.code}${edited ? " (edited the labels)" : ""}`;
      const done = await store.decideMinedMistake(id, decision === "approved" ? "APPROVED" : "REJECTED", approver, newSource);
      minedCache.delete(row.skillId);
      await log(null, "mined_mistake_decided", { classId, id, decision, done, edited });
      return done ? { ok: true } : { ok: false, reason: "Someone else decided it first." };
    },

    // ----- teacher -----
    /** Mistake patterns (2+ different questions), single slips and the line grid, for the last 7 days. */
    async getStuckBoard(classId: string) {
      await requireClass(classId);
      return stuckGroups(classId);
    },

    /** Anonymous counts only: no student codes, ids or class codes. */
    async exportPilotCsv(classId: string): Promise<string> {
      const cls = await requireClass(classId);
      const students = await store.countStudents(classId);
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
      const rows = (await store.exportCounts(classId)).map((c) =>
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
      await log(null, "pilot_export", { classId, rows: rows.length });
      return [header.join(","), ...rows].join("\n") + "\n";
    },
  };
}

export type Services = ReturnType<typeof createServices>;
