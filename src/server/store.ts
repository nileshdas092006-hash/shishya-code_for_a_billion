import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

// The data store. ALL SQL lives in this file, behind plain functions, so it can move to Postgres later.
// Pseudonymous only: there is no name column anywhere. The mastery table is written only via writeMastery(),
// which only src/server/mastery.ts may call (a test enforces this).

export const DEFAULT_DB_FILE = join(process.cwd(), "data", "shishya.db");

export type MasteryState = "LOCKED" | "OPEN" | "KEY1" | "NOT_YET" | "MASTERED";
export type ItemKind = "practice" | "teach" | "proof";
export type ItemFormat = "solve" | "apply";

export type ClassRow = { id: string; code: string; grade: number; aiAllowed: boolean };
export type StudentRow = { id: string; classId: string; code: string };
export type ItemRow = {
  id: string;
  studentId: string;
  skillId: string;
  version: string;
  seed: number;
  kind: ItemKind;
  format: ItemFormat;
  /** Teach session id (kind 'teach') or proof run id (kind 'proof'). */
  runId: string | null;
  /** The Shishya's mistake for a teach item. */
  mistakeId: string | null;
  paramsJson: string;
  answer: string;
  servedAt: string;
  answeredAt: string | null;
};
export type AttemptRow = {
  id: string;
  studentId: string;
  itemId: string;
  answer: string;
  correct: boolean;
  /** null when correct; otherwise a mistake id or "unknown". */
  mistakeId: string | null;
  createdAt: string;
};
export type TeachTraceRow = {
  id: string;
  studentId: string;
  itemId: string;
  mistakeId: string;
  tryNumber: number;
  tappedLine: number;
  typedLine: string;
  lineCorrect: boolean;
  fixAccepted: boolean;
  createdAt: string;
};
export type ProofRunRow = {
  id: string;
  studentId: string;
  skillId: string;
  version: string;
  itemIds: string[];
  aiOff: boolean;
  passed: boolean | null;
  startedAt: string;
  finishedAt: string | null;
};
export type MasteryRow = {
  studentId: string;
  skillId: string;
  state: MasteryState;
  evidenceJson: string;
  version: string;
  updatedAt: string;
};
export type UnknownErrorRow = { id: number; skillId: string; paramsJson: string; wrongAnswer: string; count: number };
export type EventRow = { id: number; studentId: string | null; type: string; payloadJson: string; createdAt: string };
export type MistakeHitRow = { studentId: string; code: string; skillId: string; mistakeId: string; createdAt: string };
export type ExportCounts = {
  skillId: string;
  practiceAnswers: number;
  practiceCorrect: number;
  unknownWrongAnswers: number;
  teachTries: number;
  teachFixes: number;
  proofRuns: number;
  proofsPassed: number;
  studentsKey1: number;
  studentsMastered: number;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  aiAllowed INTEGER NOT NULL CHECK (aiAllowed IN (0, 1))
);
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  classId TEXT NOT NULL REFERENCES classes(id),
  code TEXT NOT NULL,
  UNIQUE (classId, code)
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  studentId TEXT NOT NULL REFERENCES students(id),
  skillId TEXT NOT NULL,
  version TEXT NOT NULL,
  seed INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('practice', 'teach', 'proof')),
  format TEXT NOT NULL DEFAULT 'solve' CHECK (format IN ('solve', 'apply')),
  runId TEXT,
  mistakeId TEXT,
  paramsJson TEXT NOT NULL,
  answer TEXT NOT NULL,
  servedAt TEXT NOT NULL,
  answeredAt TEXT
);
-- A proof question is single-use: the same (skill, version, format, seed) is never served twice, to anyone.
CREATE UNIQUE INDEX IF NOT EXISTS items_proof_single_use ON items (skillId, version, format, seed) WHERE kind = 'proof';
CREATE INDEX IF NOT EXISTS items_student_skill ON items (studentId, skillId);
CREATE INDEX IF NOT EXISTS items_run ON items (runId);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  studentId TEXT NOT NULL REFERENCES students(id),
  itemId TEXT NOT NULL REFERENCES items(id),
  answer TEXT NOT NULL,
  correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
  mistakeId TEXT,
  createdAt TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS attempts_one_per_item ON attempts (itemId);
CREATE INDEX IF NOT EXISTS attempts_student_time ON attempts (studentId, createdAt);
CREATE TABLE IF NOT EXISTS teachTraces (
  id TEXT PRIMARY KEY,
  studentId TEXT NOT NULL REFERENCES students(id),
  itemId TEXT NOT NULL REFERENCES items(id),
  mistakeId TEXT NOT NULL,
  tryNumber INTEGER NOT NULL,
  tappedLine INTEGER NOT NULL,
  typedLine TEXT NOT NULL,
  lineCorrect INTEGER NOT NULL CHECK (lineCorrect IN (0, 1)),
  fixAccepted INTEGER NOT NULL CHECK (fixAccepted IN (0, 1)),
  createdAt TEXT NOT NULL,
  UNIQUE (itemId, tryNumber)
);
CREATE TABLE IF NOT EXISTS proofRuns (
  id TEXT PRIMARY KEY,
  studentId TEXT NOT NULL REFERENCES students(id),
  skillId TEXT NOT NULL,
  version TEXT NOT NULL,
  itemIds TEXT NOT NULL,
  aiOff INTEGER NOT NULL CHECK (aiOff IN (0, 1)),
  passed INTEGER CHECK (passed IN (0, 1)),
  startedAt TEXT NOT NULL,
  finishedAt TEXT
);
-- At most one unfinished proof run per student and skill.
CREATE UNIQUE INDEX IF NOT EXISTS proof_one_open ON proofRuns (studentId, skillId) WHERE finishedAt IS NULL;
CREATE TABLE IF NOT EXISTS mastery (
  studentId TEXT NOT NULL REFERENCES students(id),
  skillId TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('LOCKED', 'OPEN', 'KEY1', 'NOT_YET', 'MASTERED')),
  evidenceJson TEXT NOT NULL,
  version TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (studentId, skillId)
);
CREATE TABLE IF NOT EXISTS unknownErrors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skillId TEXT NOT NULL,
  paramsJson TEXT NOT NULL,
  wrongAnswer TEXT NOT NULL,
  count INTEGER NOT NULL,
  UNIQUE (skillId, paramsJson, wrongAnswer)
);
CREATE TABLE IF NOT EXISTS minedMistakes (
  id TEXT PRIMARY KEY,
  skillId TEXT NOT NULL,
  source TEXT NOT NULL,
  testsJson TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'rejected')),
  approver TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  studentId TEXT,
  type TEXT NOT NULL,
  payloadJson TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_type_time ON events (type, createdAt);
`;

type Row = Record<string, SQLInputValue>;
const bool = (v: unknown) => Number(v) === 1;
const isUniqueViolation = (e: unknown) => e instanceof Error && /UNIQUE constraint failed/i.test(e.message);

const toItem = (r: Row): ItemRow => ({
  id: r.id as string,
  studentId: r.studentId as string,
  skillId: r.skillId as string,
  version: r.version as string,
  seed: Number(r.seed),
  kind: r.kind as ItemKind,
  format: r.format as ItemFormat,
  runId: (r.runId as string | null) ?? null,
  mistakeId: (r.mistakeId as string | null) ?? null,
  paramsJson: r.paramsJson as string,
  answer: r.answer as string,
  servedAt: r.servedAt as string,
  answeredAt: (r.answeredAt as string | null) ?? null,
});
const toAttempt = (r: Row): AttemptRow => ({
  id: r.id as string,
  studentId: r.studentId as string,
  itemId: r.itemId as string,
  answer: r.answer as string,
  correct: bool(r.correct),
  mistakeId: (r.mistakeId as string | null) ?? null,
  createdAt: r.createdAt as string,
});
const toTrace = (r: Row): TeachTraceRow => ({
  id: r.id as string,
  studentId: r.studentId as string,
  itemId: r.itemId as string,
  mistakeId: r.mistakeId as string,
  tryNumber: Number(r.tryNumber),
  tappedLine: Number(r.tappedLine),
  typedLine: r.typedLine as string,
  lineCorrect: bool(r.lineCorrect),
  fixAccepted: bool(r.fixAccepted),
  createdAt: r.createdAt as string,
});
const toRun = (r: Row): ProofRunRow => ({
  id: r.id as string,
  studentId: r.studentId as string,
  skillId: r.skillId as string,
  version: r.version as string,
  itemIds: JSON.parse(r.itemIds as string),
  aiOff: bool(r.aiOff),
  passed: r.passed === null || r.passed === undefined ? null : bool(r.passed),
  startedAt: r.startedAt as string,
  finishedAt: (r.finishedAt as string | null) ?? null,
});

export function openStore(file: string = DEFAULT_DB_FILE) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);

  const one = (sql: string, ...params: SQLInputValue[]) => db.prepare(sql).get(...params) as Row | undefined;
  const all = (sql: string, ...params: SQLInputValue[]) => db.prepare(sql).all(...params) as Row[];
  const run = (sql: string, ...params: SQLInputValue[]) => db.prepare(sql).run(...params);
  /** Runs an INSERT; false if a unique rule refused it. */
  const tryInsert = (sql: string, ...params: SQLInputValue[]) => {
    try {
      run(sql, ...params);
      return true;
    } catch (e) {
      if (isUniqueViolation(e)) return false;
      throw e;
    }
  };

  let depth = 0;

  return {
    close: () => db.close(),

    /** BEGIN IMMEDIATE ... COMMIT, rolled back on error. Nested calls join the outer transaction. */
    transaction<T>(fn: () => T): T {
      if (depth > 0) return fn();
      db.exec("BEGIN IMMEDIATE");
      depth++;
      try {
        const out = fn();
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      } finally {
        depth--;
      }
    },

    // ----- classes and students -----
    insertClass(c: ClassRow) {
      run("INSERT INTO classes (id, code, grade, aiAllowed) VALUES (?, ?, ?, ?)", c.id, c.code, c.grade, c.aiAllowed ? 1 : 0);
    },
    getClass(id: string): ClassRow | undefined {
      const r = one("SELECT * FROM classes WHERE id = ?", id);
      return r && { id: r.id as string, code: r.code as string, grade: Number(r.grade), aiAllowed: bool(r.aiAllowed) };
    },
    insertStudent(s: StudentRow) {
      run("INSERT INTO students (id, classId, code) VALUES (?, ?, ?)", s.id, s.classId, s.code);
    },
    getStudent(id: string): StudentRow | undefined {
      return one("SELECT id, classId, code FROM students WHERE id = ?", id) as StudentRow | undefined;
    },
    countStudents(classId: string): number {
      return Number(one("SELECT COUNT(*) AS n FROM students WHERE classId = ?", classId)!.n);
    },

    // ----- items -----
    /** False if the unique rules refuse it (for example a proof question that was already used). */
    insertItem(i: Omit<ItemRow, "answeredAt">): boolean {
      return tryInsert(
        `INSERT INTO items (id, studentId, skillId, version, seed, kind, format, runId, mistakeId, paramsJson, answer, servedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        i.id, i.studentId, i.skillId, i.version, i.seed, i.kind, i.format, i.runId, i.mistakeId, i.paramsJson, i.answer, i.servedAt,
      );
    },
    getItem(id: string): ItemRow | undefined {
      const r = one("SELECT * FROM items WHERE id = ?", id);
      return r && toItem(r);
    },
    listItems(f: { studentId: string; skillId: string; kind?: ItemKind; version?: string }): ItemRow[] {
      return all(
        `SELECT * FROM items WHERE studentId = ? AND skillId = ? AND (? IS NULL OR kind = ?) AND (? IS NULL OR version = ?)
         ORDER BY servedAt, rowid`,
        f.studentId, f.skillId, f.kind ?? null, f.kind ?? null, f.version ?? null, f.version ?? null,
      ).map(toItem);
    },
    listRunItems(runId: string): ItemRow[] {
      return all("SELECT * FROM items WHERE runId = ? ORDER BY rowid", runId).map(toItem);
    },
    /** Marks an item answered. False if it was already answered (so two racing answers cannot both count). */
    markItemAnswered(id: string, at: string): boolean {
      return Number(run("UPDATE items SET answeredAt = ? WHERE id = ? AND answeredAt IS NULL", at, id).changes) === 1;
    },

    // ----- attempts -----
    insertAttempt(a: AttemptRow): boolean {
      return tryInsert(
        "INSERT INTO attempts (id, studentId, itemId, answer, correct, mistakeId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        a.id, a.studentId, a.itemId, a.answer, a.correct ? 1 : 0, a.mistakeId, a.createdAt,
      );
    },
    listAttemptsForItem(itemId: string): AttemptRow[] {
      return all("SELECT * FROM attempts WHERE itemId = ? ORDER BY createdAt, rowid", itemId).map(toAttempt);
    },
    /** Wrong answers (with a mistake id or "unknown") by students of one class since a time. */
    listClassMistakesSince(classId: string, since: string): MistakeHitRow[] {
      return all(
        `SELECT a.studentId, s.code, i.skillId, a.mistakeId, a.createdAt
         FROM attempts a JOIN students s ON s.id = a.studentId JOIN items i ON i.id = a.itemId
         WHERE s.classId = ? AND a.correct = 0 AND a.mistakeId IS NOT NULL AND a.createdAt >= ?
         ORDER BY a.createdAt, a.rowid`,
        classId, since,
      ) as MistakeHitRow[];
    },

    // ----- teach traces -----
    /** False if this try number was already used for the item. */
    insertTeachTrace(t: TeachTraceRow): boolean {
      return tryInsert(
        `INSERT INTO teachTraces (id, studentId, itemId, mistakeId, tryNumber, tappedLine, typedLine, lineCorrect, fixAccepted, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        t.id, t.studentId, t.itemId, t.mistakeId, t.tryNumber, t.tappedLine, t.typedLine,
        t.lineCorrect ? 1 : 0, t.fixAccepted ? 1 : 0, t.createdAt,
      );
    },
    listTeachTraces(itemId: string): TeachTraceRow[] {
      return all("SELECT * FROM teachTraces WHERE itemId = ? ORDER BY tryNumber", itemId).map(toTrace);
    },

    // ----- proof runs -----
    /** False if the student already has an unfinished run for this skill. */
    insertProofRun(r: Omit<ProofRunRow, "passed" | "finishedAt">): boolean {
      return tryInsert(
        "INSERT INTO proofRuns (id, studentId, skillId, version, itemIds, aiOff, startedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        r.id, r.studentId, r.skillId, r.version, JSON.stringify(r.itemIds), r.aiOff ? 1 : 0, r.startedAt,
      );
    },
    setProofRunItems(id: string, itemIds: string[]) {
      run("UPDATE proofRuns SET itemIds = ? WHERE id = ? AND finishedAt IS NULL", JSON.stringify(itemIds), id);
    },
    getProofRun(id: string): ProofRunRow | undefined {
      const r = one("SELECT * FROM proofRuns WHERE id = ?", id);
      return r && toRun(r);
    },
    getOpenProofRun(studentId: string, skillId: string): ProofRunRow | undefined {
      const r = one("SELECT * FROM proofRuns WHERE studentId = ? AND skillId = ? AND finishedAt IS NULL", studentId, skillId);
      return r && toRun(r);
    },
    getLastFinishedProofRun(studentId: string, skillId: string): ProofRunRow | undefined {
      const r = one(
        `SELECT * FROM proofRuns WHERE studentId = ? AND skillId = ? AND finishedAt IS NOT NULL
         ORDER BY finishedAt DESC, rowid DESC LIMIT 1`,
        studentId, skillId,
      );
      return r && toRun(r);
    },
    /** False if the run was already finished. */
    finishProofRun(id: string, passed: boolean, at: string): boolean {
      return (
        Number(run("UPDATE proofRuns SET passed = ?, finishedAt = ? WHERE id = ? AND finishedAt IS NULL", passed ? 1 : 0, at, id)
          .changes) === 1
      );
    },

    // ----- mastery (ONLY src/server/mastery.ts may call writeMastery) -----
    getMastery(studentId: string, skillId: string): MasteryRow | undefined {
      return one("SELECT * FROM mastery WHERE studentId = ? AND skillId = ?", studentId, skillId) as MasteryRow | undefined;
    },
    writeMastery(m: MasteryRow) {
      run(
        `INSERT INTO mastery (studentId, skillId, state, evidenceJson, version, updatedAt) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (studentId, skillId) DO UPDATE SET
           state = excluded.state, evidenceJson = excluded.evidenceJson, version = excluded.version, updatedAt = excluded.updatedAt`,
        m.studentId, m.skillId, m.state, m.evidenceJson, m.version, m.updatedAt,
      );
    },

    // ----- unknown errors (input for the Misconception Miner) -----
    recordUnknownError(skillId: string, paramsJson: string, wrongAnswer: string) {
      run(
        `INSERT INTO unknownErrors (skillId, paramsJson, wrongAnswer, count) VALUES (?, ?, ?, 1)
         ON CONFLICT (skillId, paramsJson, wrongAnswer) DO UPDATE SET count = count + 1`,
        skillId, paramsJson, wrongAnswer,
      );
    },
    listUnknownErrors(skillId: string): UnknownErrorRow[] {
      return all("SELECT * FROM unknownErrors WHERE skillId = ? ORDER BY count DESC, id", skillId).map((r) => ({
        id: Number(r.id),
        skillId: r.skillId as string,
        paramsJson: r.paramsJson as string,
        wrongAnswer: r.wrongAnswer as string,
        count: Number(r.count),
      }));
    },

    // ----- events (pilot metrics) -----
    logEvent(studentId: string | null, type: string, payload: unknown, at: string) {
      run("INSERT INTO events (studentId, type, payloadJson, createdAt) VALUES (?, ?, ?, ?)", studentId, type, JSON.stringify(payload ?? {}), at);
    },
    listEvents(): EventRow[] {
      return all("SELECT * FROM events ORDER BY id").map((r) => ({
        id: Number(r.id),
        studentId: (r.studentId as string | null) ?? null,
        type: r.type as string,
        payloadJson: r.payloadJson as string,
        createdAt: r.createdAt as string,
      }));
    },

    // ----- pilot export: counts only -----
    exportCounts(classId: string): ExportCounts[] {
      const bySkill = new Map<string, ExportCounts>();
      const get = (skillId: string) => {
        let c = bySkill.get(skillId);
        if (!c) {
          c = {
            skillId,
            practiceAnswers: 0,
            practiceCorrect: 0,
            unknownWrongAnswers: 0,
            teachTries: 0,
            teachFixes: 0,
            proofRuns: 0,
            proofsPassed: 0,
            studentsKey1: 0,
            studentsMastered: 0,
          };
          bySkill.set(skillId, c);
        }
        return c;
      };
      for (const r of all(
        `SELECT i.skillId, COUNT(*) AS n, SUM(a.correct) AS ok, SUM(a.mistakeId = 'unknown') AS unk
         FROM attempts a JOIN items i ON i.id = a.itemId JOIN students s ON s.id = a.studentId
         WHERE s.classId = ? AND i.kind = 'practice' GROUP BY i.skillId`,
        classId,
      )) Object.assign(get(r.skillId as string), { practiceAnswers: Number(r.n), practiceCorrect: Number(r.ok), unknownWrongAnswers: Number(r.unk) });
      for (const r of all(
        `SELECT i.skillId, COUNT(*) AS n, SUM(t.lineCorrect AND t.fixAccepted) AS ok
         FROM teachTraces t JOIN items i ON i.id = t.itemId JOIN students s ON s.id = t.studentId
         WHERE s.classId = ? GROUP BY i.skillId`,
        classId,
      )) Object.assign(get(r.skillId as string), { teachTries: Number(r.n), teachFixes: Number(r.ok) });
      for (const r of all(
        `SELECT p.skillId, COUNT(*) AS n, SUM(p.passed) AS ok
         FROM proofRuns p JOIN students s ON s.id = p.studentId
         WHERE s.classId = ? AND p.finishedAt IS NOT NULL GROUP BY p.skillId`,
        classId,
      )) Object.assign(get(r.skillId as string), { proofRuns: Number(r.n), proofsPassed: Number(r.ok) });
      for (const r of all(
        `SELECT m.skillId, SUM(m.state IN ('KEY1', 'NOT_YET', 'MASTERED')) AS k, SUM(m.state = 'MASTERED') AS mm
         FROM mastery m JOIN students s ON s.id = m.studentId WHERE s.classId = ? GROUP BY m.skillId`,
        classId,
      )) Object.assign(get(r.skillId as string), { studentsKey1: Number(r.k), studentsMastered: Number(r.mm) });
      return [...bySkill.values()].sort((a, b) => a.skillId.localeCompare(b.skillId));
    },

    /** Every column of every table (used by the privacy test). */
    listColumns(): { table: string; column: string }[] {
      const tables = all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
      return tables.flatMap((t) =>
        all(`PRAGMA table_info(${t.name as string})`).map((c) => ({ table: t.name as string, column: c.name as string })),
      );
    },
  };
}

export type Store = ReturnType<typeof openStore>;
