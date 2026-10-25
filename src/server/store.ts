import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";

// The data store. ALL SQL lives in this file, behind plain async functions.
// It uses libSQL (SQLite-compatible): a local file on a laptop (DATABASE_URL=file:data/shishya.db) or Turso's
// hosted database in the cloud (DATABASE_URL=libsql://…), which is what Vercel needs.
// Pseudonymous only: there is no name column anywhere. The mastery table is written only via writeMastery(),
// which only src/server/mastery.ts may call (a test enforces this).

export const DEFAULT_DATABASE_URL = "file:data/shishya.db";

export type MasteryState = "LOCKED" | "OPEN" | "KEY1" | "NOT_YET" | "MASTERED";
export type ItemKind = "practice" | "teach" | "proof";
export type ItemFormat = "solve" | "apply";

export type ClassRow = {
  id: string;
  code: string;
  grade: number;
  section: string;
  aiAllowed: boolean;
  /** A proof can start only while the teacher has opened the proof window (false for classes made before windows existed). */
  proofWindowRequired: boolean;
  /** Until when the teacher opened the proof window (null: closed). */
  proofWindowOpenUntil: string | null;
};
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
export type MinedStatus = "DRAFT_TESTED" | "APPROVED" | "REJECTED";
export type MinedMistakeRow = {
  id: string;
  skillId: string;
  source: string;
  testsJson: string;
  /** DRAFT_TESTED: passed the validator, waiting for a teacher. APPROVED drafts are used by the app. */
  status: MinedStatus;
  approver: string | null;
  createdAt: string;
};
export type EventRow = { id: number; studentId: string | null; type: string; payloadJson: string; createdAt: string };
export type MistakeHitRow = {
  studentId: string;
  code: string;
  skillId: string;
  mistakeId: string;
  createdAt: string;
  /** The question it was on (two items with the same params are the same question). */
  itemId: string;
  paramsJson: string;
  seed: number;
  format: ItemFormat;
};
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
  section TEXT NOT NULL DEFAULT '',
  aiAllowed INTEGER NOT NULL CHECK (aiAllowed IN (0, 1)),
  -- salted scrypt hash of the teacher PIN; the PIN itself is never stored
  teacherPinHash TEXT,
  -- 1: a proof starts only while the teacher has opened the proof window (until proofWindowOpenUntil)
  proofWindowRequired INTEGER NOT NULL DEFAULT 1 CHECK (proofWindowRequired IN (0, 1)),
  proofWindowOpenUntil TEXT
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
  status TEXT NOT NULL CHECK (status IN ('DRAFT_TESTED', 'APPROVED', 'REJECTED')),
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

type Row = Record<string, unknown>;
const bool = (v: unknown) => Number(v) === 1;
const isUniqueViolation = (e: unknown) => e instanceof Error && /UNIQUE constraint failed/i.test(e.message);

const toClass = (r: Row): ClassRow => ({
  id: r.id as string,
  code: r.code as string,
  grade: Number(r.grade),
  section: (r.section as string) ?? "",
  aiAllowed: bool(r.aiAllowed),
  proofWindowRequired: bool(r.proofWindowRequired),
  proofWindowOpenUntil: (r.proofWindowOpenUntil as string | null) ?? null,
});
const CLASS_COLUMNS = "id, code, grade, section, aiAllowed, proofWindowRequired, proofWindowOpenUntil";
const CLASS_COLUMNS_OF_C = CLASS_COLUMNS.split(", ").map((c) => `c.${c}`).join(", ");
/**
 * How many failed logins of this type the class c has had since a time, as a subquery (it uses the
 * events_type_time index). Refusals during a lockout (lockedOut) are not counted again.
 */
const recentFailures = (type: "student_login" | "teacher_login") =>
  `(SELECT COUNT(*) FROM events WHERE type = '${type}' AND createdAt >= ?
     AND json_extract(payloadJson, '$.classId') = c.id AND json_extract(payloadJson, '$.ok') = 0
     AND json_extract(payloadJson, '$.lockedOut') IS NULL)`;
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
const toMined = (r: Row): MinedMistakeRow => ({
  id: r.id as string,
  skillId: r.skillId as string,
  source: r.source as string,
  testsJson: r.testsJson as string,
  status: r.status as MinedStatus,
  approver: (r.approver as string | null) ?? null,
  createdAt: r.createdAt as string,
});
const toStudent = (r: Row): StudentRow => ({ id: r.id as string, classId: r.classId as string, code: r.code as string });
const toMastery = (r: Row): MasteryRow => ({
  studentId: r.studentId as string,
  skillId: r.skillId as string,
  state: r.state as MasteryState,
  evidenceJson: r.evidenceJson as string,
  version: r.version as string,
  updatedAt: r.updatedAt as string,
});
/** "?, ?, ?" for an IN (…) list. */
const marks = (n: number) => Array.from({ length: n }, () => "?").join(", ");
/** An event log line (written in the same batch as the mastery change it describes). */
export type EventInput = { studentId: string | null; type: string; payload: unknown; at: string };
const eventStatement = (e: EventInput) => ({
  sql: "INSERT INTO events (studentId, type, payloadJson, createdAt) VALUES (?, ?, ?, ?)",
  args: [e.studentId, e.type, JSON.stringify(e.payload ?? {}), e.at] as InValue[],
});

// ---------- migrations (each safe to run on every start-up) ----------

async function migrate(client: Client) {
  // Proof windows: classes that already exist keep working without one (0); new classes need one (insertClass).
  const classColumns = (await client.execute("PRAGMA table_info(classes)")).rows.map((r) => r.name);
  if (!classColumns.includes("proofWindowRequired")) {
    await client.execute("ALTER TABLE classes ADD COLUMN proofWindowRequired INTEGER NOT NULL DEFAULT 0 CHECK (proofWindowRequired IN (0, 1))");
  }
  if (!classColumns.includes("proofWindowOpenUntil")) await client.execute("ALTER TABLE classes ADD COLUMN proofWindowOpenUntil TEXT");

  // Mined mistake statuses were draft/approved/rejected; now DRAFT_TESTED/APPROVED/REJECTED.
  const mined = await client.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'minedMistakes'");
  if (String(mined.rows[0]?.sql ?? "").includes("'draft'")) {
    await client.batch(
      [
        `CREATE TABLE minedMistakes_v2 (
          id TEXT PRIMARY KEY, skillId TEXT NOT NULL, source TEXT NOT NULL, testsJson TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('DRAFT_TESTED', 'APPROVED', 'REJECTED')), approver TEXT, createdAt TEXT NOT NULL)`,
        `INSERT INTO minedMistakes_v2 (id, skillId, source, testsJson, status, approver, createdAt)
         SELECT id, skillId, source, testsJson,
                CASE status WHEN 'draft' THEN 'DRAFT_TESTED' WHEN 'approved' THEN 'APPROVED' ELSE 'REJECTED' END,
                approver, createdAt FROM minedMistakes`,
        "DROP TABLE minedMistakes",
        "ALTER TABLE minedMistakes_v2 RENAME TO minedMistakes",
      ],
      "write",
    );
  }
}

// ---------- connections, write lock and transactions ----------

/** Runs async jobs one at a time, in order. */
class Lock {
  #tail: Promise<unknown> = Promise.resolve();
  run<T>(job: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(job);
    this.#tail = result.catch(() => undefined);
    return result;
  }
}

/**
 * One write lock per database per process. Local libSQL connections are synchronous, so if two connections in
 * one process wrote at the same moment, the second would block the whole process while waiting for the first,
 * and the first could never finish. Taking turns inside the process avoids that; across processes and on Turso,
 * SQLite's own locking (and our unique indexes) keep things safe.
 */
const writeLocks = new Map<string, Lock>();

function localPath(url: string): string | null {
  if (!url.startsWith("file:")) return null;
  if (url.startsWith("file://")) return fileURLToPath(url);
  return resolve(url.slice("file:".length));
}

export type StoreConfig = {
  url?: string;
  authToken?: string;
  /** Called once per database round trip (each query, batch, BEGIN, COMMIT or ROLLBACK). Tests count them. */
  onRoundTrip?: () => void;
};

/** Opens the database and creates the tables if they are missing (safe to run every start-up). */
export async function openStore(config: StoreConfig | string = {}) {
  const { url = DEFAULT_DATABASE_URL, authToken, onRoundTrip } = typeof config === "string" ? { url: config } : config;
  const trip = () => onRoundTrip?.();
  const path = localPath(url);
  if (path) mkdirSync(dirname(path), { recursive: true }); // local files only; never runs for a cloud database
  const client: Client = createClient({ url, authToken, timeout: 5000 });
  if (path) await client.execute("PRAGMA journal_mode = WAL"); // readers never wait for a writer
  await client.executeMultiple(SCHEMA);
  await migrate(client);

  const lockKey = path ? path.toLowerCase() : url;
  if (!writeLocks.has(lockKey)) writeLocks.set(lockKey, new Lock());
  const lock = writeLocks.get(lockKey)!;
  const inTx = new AsyncLocalStorage<Transaction>();

  /** A read: inside a transaction it sees that transaction's own writes. */
  const read = async (sql: string, ...args: InValue[]) => (trip(), (inTx.getStore() ?? client).execute({ sql, args }));
  /** A write: joins the current transaction, or takes the write lock for a single statement. */
  const write = async (sql: string, ...args: InValue[]) => {
    const tx = inTx.getStore();
    trip();
    return tx ? tx.execute({ sql, args }) : lock.run(() => client.execute({ sql, args }));
  };
  const one = async (sql: string, ...args: InValue[]) => (await read(sql, ...args)).rows[0] as Row | undefined;
  const all = async (sql: string, ...args: InValue[]) => (await read(sql, ...args)).rows as unknown as Row[];
  const changed = async (sql: string, ...args: InValue[]) => (await write(sql, ...args)).rowsAffected === 1;
  /** Runs an INSERT; false if a unique rule refused it. */
  const tryInsert = async (sql: string, ...args: InValue[]) => {
    try {
      await write(sql, ...args);
      return true;
    } catch (e) {
      if (isUniqueViolation(e)) return false;
      throw e;
    }
  };

  /** Several writes in ONE round trip, all or nothing (inside a transaction they join it). */
  const writeBatch = async (statements: { sql: string; args: InValue[] }[]) => {
    if (statements.length === 0) return;
    trip();
    const tx = inTx.getStore();
    if (tx) await tx.batch(statements);
    else await lock.run(() => client.batch(statements, "write"));
  };

  return {
    close: () => client.close(),

    /** BEGIN IMMEDIATE … COMMIT, rolled back on error. Nested calls join the outer transaction. */
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      if (inTx.getStore()) return fn();
      return lock.run(async () => {
        trip();
        const tx = await client.transaction("write");
        try {
          const out = await inTx.run(tx, fn);
          trip();
          await tx.commit();
          return out;
        } catch (e) {
          trip();
          await tx.rollback().catch(() => undefined);
          throw e;
        } finally {
          tx.close();
        }
      });
    },

    // ----- classes and students -----
    /** False if the class code is already taken. */
    insertClass(c: ClassRow, teacherPinHash: string | null = null): Promise<boolean> {
      return tryInsert(
        `INSERT INTO classes (id, code, grade, section, aiAllowed, teacherPinHash, proofWindowRequired, proofWindowOpenUntil)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id, c.code, c.grade, c.section, c.aiAllowed ? 1 : 0, teacherPinHash, c.proofWindowRequired ? 1 : 0, c.proofWindowOpenUntil,
      );
    },
    async getClass(id: string): Promise<ClassRow | undefined> {
      const r = await one(`SELECT ${CLASS_COLUMNS} FROM classes WHERE id = ?`, id);
      return r && toClass(r);
    },
    async getClassByCode(code: string): Promise<ClassRow | undefined> {
      const r = await one(`SELECT ${CLASS_COLUMNS} FROM classes WHERE code = ?`, code);
      return r && toClass(r);
    },
    /** The class, its teacher PIN hash and its failed PIN checks since a time, in one read (for the PIN check). */
    async getClassWithPinHashByCode(
      code: string,
      failuresSince: string,
    ): Promise<{ cls: ClassRow; pinHash: string | null; recentFailures: number } | undefined> {
      const r = await one(`SELECT c.*, ${recentFailures("teacher_login")} AS failures FROM classes c WHERE c.code = ?`, failuresSince, code);
      return r && { cls: toClass(r), pinHash: (r.teacherPinHash as string | null) ?? null, recentFailures: Number(r.failures) };
    },
    /** For a student log-in, in one read: the class, its student with that code (if any) and the class's failed log-ins since a time. */
    async findLogin(
      classCode: string,
      studentCode: string,
      failuresSince: string,
    ): Promise<{ cls: ClassRow; student: StudentRow | undefined; recentFailures: number } | undefined> {
      const r = await one(
        `SELECT ${CLASS_COLUMNS_OF_C}, s.id AS studentId, ${recentFailures("student_login")} AS failures
         FROM classes c LEFT JOIN students s ON s.classId = c.id AND s.code = ? WHERE c.code = ?`,
        failuresSince, studentCode, classCode,
      );
      if (!r) return undefined;
      const student = r.studentId ? { id: r.studentId as string, classId: r.id as string, code: studentCode } : undefined;
      return { cls: toClass(r), student, recentFailures: Number(r.failures) };
    },
    /** Opens the proof window until a time, or closes it (null). */
    async setProofWindow(classId: string, openUntil: string | null) {
      await write("UPDATE classes SET proofWindowOpenUntil = ? WHERE id = ?", openUntil, classId);
    },
    async getClassPinHash(id: string): Promise<string | null> {
      return ((await one("SELECT teacherPinHash FROM classes WHERE id = ?", id))?.teacherPinHash as string | null) ?? null;
    },
    async insertStudent(s: StudentRow) {
      await write("INSERT INTO students (id, classId, code) VALUES (?, ?, ?)", s.id, s.classId, s.code);
    },
    async getStudent(id: string): Promise<StudentRow | undefined> {
      const r = await one("SELECT id, classId, code FROM students WHERE id = ?", id);
      return r && toStudent(r);
    },
    async findStudentByCode(classId: string, code: string): Promise<StudentRow | undefined> {
      const r = await one("SELECT id, classId, code FROM students WHERE classId = ? AND code = ?", classId, code);
      return r && toStudent(r);
    },
    async listStudents(classId: string): Promise<StudentRow[]> {
      return (await all("SELECT id, classId, code FROM students WHERE classId = ? ORDER BY code", classId)).map(toStudent);
    },
    /** Gives students new codes (ids and everything else stay) and logs the event, in one round trip, all or nothing. */
    async setStudentCodes(classId: string, codes: { id: string; code: string }[], event: EventInput) {
      await writeBatch([
        ...codes.map((c) => ({ sql: "UPDATE students SET code = ? WHERE id = ? AND classId = ?", args: [c.code, c.id, classId] as InValue[] })),
        eventStatement(event),
      ]);
    },
    async countStudents(classId: string): Promise<number> {
      return Number((await one("SELECT COUNT(*) AS n FROM students WHERE classId = ?", classId))!.n);
    },

    // ----- items -----
    /** False if the unique rules refuse it (for example a proof question that was already used). */
    insertItem(i: Omit<ItemRow, "answeredAt">): Promise<boolean> {
      return tryInsert(
        `INSERT INTO items (id, studentId, skillId, version, seed, kind, format, runId, mistakeId, paramsJson, answer, servedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        i.id, i.studentId, i.skillId, i.version, i.seed, i.kind, i.format, i.runId, i.mistakeId, i.paramsJson, i.answer, i.servedAt,
      );
    },
    async getItem(id: string): Promise<ItemRow | undefined> {
      const r = await one("SELECT * FROM items WHERE id = ?", id);
      return r && toItem(r);
    },
    async listItems(f: { studentId: string; skillId: string; kind?: ItemKind; version?: string }): Promise<ItemRow[]> {
      return (
        await all(
          `SELECT * FROM items WHERE studentId = ? AND skillId = ? AND (? IS NULL OR kind = ?) AND (? IS NULL OR version = ?)
           ORDER BY servedAt, rowid`,
          f.studentId, f.skillId, f.kind ?? null, f.kind ?? null, f.version ?? null, f.version ?? null,
        )
      ).map(toItem);
    },
    /** Several items in one read (missing ids are simply absent). */
    async getItems(ids: string[]): Promise<ItemRow[]> {
      if (ids.length === 0) return [];
      return (await all(`SELECT * FROM items WHERE id IN (${marks(ids.length)})`, ...ids)).map(toItem);
    },
    async listRunItems(runId: string): Promise<ItemRow[]> {
      return (await all("SELECT * FROM items WHERE runId = ? ORDER BY rowid", runId)).map(toItem);
    },
    /** Marks an item answered. False if it was already answered (so two racing answers cannot both count). */
    markItemAnswered(id: string, at: string): Promise<boolean> {
      return changed("UPDATE items SET answeredAt = ? WHERE id = ? AND answeredAt IS NULL", at, id);
    },

    // ----- attempts -----
    insertAttempt(a: AttemptRow): Promise<boolean> {
      return tryInsert(
        "INSERT INTO attempts (id, studentId, itemId, answer, correct, mistakeId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        a.id, a.studentId, a.itemId, a.answer, a.correct ? 1 : 0, a.mistakeId, a.createdAt,
      );
    },
    /** The attempts of several items in one read, oldest first. */
    async listAttemptsForItems(itemIds: string[]): Promise<AttemptRow[]> {
      if (itemIds.length === 0) return [];
      return (await all(`SELECT * FROM attempts WHERE itemId IN (${marks(itemIds.length)}) ORDER BY createdAt, rowid`, ...itemIds)).map(toAttempt);
    },
    async listAttemptsForItem(itemId: string): Promise<AttemptRow[]> {
      return (await all("SELECT * FROM attempts WHERE itemId = ? ORDER BY createdAt, rowid", itemId)).map(toAttempt);
    },
    /** Wrong answers (with a mistake id or "unknown") by students of one class since a time. */
    async listClassMistakesSince(classId: string, since: string): Promise<MistakeHitRow[]> {
      return (
        await all(
          `SELECT a.studentId, s.code, i.skillId, a.mistakeId, a.createdAt, a.itemId, i.paramsJson, i.seed, i.format
           FROM attempts a JOIN students s ON s.id = a.studentId JOIN items i ON i.id = a.itemId
           WHERE s.classId = ? AND a.correct = 0 AND a.mistakeId IS NOT NULL AND a.createdAt >= ?
           ORDER BY a.createdAt, a.rowid`,
          classId, since,
        )
      ).map((r) => ({
        studentId: r.studentId as string,
        code: r.code as string,
        skillId: r.skillId as string,
        mistakeId: r.mistakeId as string,
        createdAt: r.createdAt as string,
        itemId: r.itemId as string,
        paramsJson: r.paramsJson as string,
        seed: Number(r.seed),
        format: r.format as ItemFormat,
      }));
    },
    /** On how many different questions (by params, other than exceptParamsJson) this mistake explained the child's answer since a time. */
    async countMistakeQuestionsSince(f: { studentId: string; skillId: string; mistakeId: string; since: string; exceptParamsJson: string }): Promise<number> {
      const r = await one(
        `SELECT COUNT(DISTINCT i.paramsJson) AS n FROM attempts a JOIN items i ON i.id = a.itemId
         WHERE a.studentId = ? AND i.skillId = ? AND a.mistakeId = ? AND a.createdAt >= ? AND i.paramsJson <> ?`,
        f.studentId, f.skillId, f.mistakeId, f.since, f.exceptParamsJson,
      );
      return Number(r?.n ?? 0);
    },

    // ----- teach traces -----
    /** False if this try number was already used for the item. */
    insertTeachTrace(t: TeachTraceRow): Promise<boolean> {
      return tryInsert(
        `INSERT INTO teachTraces (id, studentId, itemId, mistakeId, tryNumber, tappedLine, typedLine, lineCorrect, fixAccepted, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        t.id, t.studentId, t.itemId, t.mistakeId, t.tryNumber, t.tappedLine, t.typedLine,
        t.lineCorrect ? 1 : 0, t.fixAccepted ? 1 : 0, t.createdAt,
      );
    },
    async listTeachTraces(itemId: string): Promise<TeachTraceRow[]> {
      return (await all("SELECT * FROM teachTraces WHERE itemId = ? ORDER BY tryNumber", itemId)).map(toTrace);
    },

    // ----- proof runs -----
    /** False if the student already has an unfinished run for this skill. */
    insertProofRun(r: Omit<ProofRunRow, "passed" | "finishedAt">): Promise<boolean> {
      return tryInsert(
        "INSERT INTO proofRuns (id, studentId, skillId, version, itemIds, aiOff, startedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        r.id, r.studentId, r.skillId, r.version, JSON.stringify(r.itemIds), r.aiOff ? 1 : 0, r.startedAt,
      );
    },
    async setProofRunItems(id: string, itemIds: string[]) {
      await write("UPDATE proofRuns SET itemIds = ? WHERE id = ? AND finishedAt IS NULL", JSON.stringify(itemIds), id);
    },
    async getProofRun(id: string): Promise<ProofRunRow | undefined> {
      const r = await one("SELECT * FROM proofRuns WHERE id = ?", id);
      return r && toRun(r);
    },
    async getOpenProofRun(studentId: string, skillId: string): Promise<ProofRunRow | undefined> {
      const r = await one("SELECT * FROM proofRuns WHERE studentId = ? AND skillId = ? AND finishedAt IS NULL", studentId, skillId);
      return r && toRun(r);
    },
    async getLastFinishedProofRun(studentId: string, skillId: string): Promise<ProofRunRow | undefined> {
      const r = await one(
        `SELECT * FROM proofRuns WHERE studentId = ? AND skillId = ? AND finishedAt IS NOT NULL
         ORDER BY finishedAt DESC, rowid DESC LIMIT 1`,
        studentId, skillId,
      );
      return r && toRun(r);
    },
    /** False if the run was already finished. */
    finishProofRun(id: string, passed: boolean, at: string): Promise<boolean> {
      return changed("UPDATE proofRuns SET passed = ?, finishedAt = ? WHERE id = ? AND finishedAt IS NULL", passed ? 1 : 0, at, id);
    },

    // ----- mastery (ONLY src/server/mastery.ts may call writeMastery) -----
    async getMastery(studentId: string, skillId: string): Promise<MasteryRow | undefined> {
      const r = await one("SELECT * FROM mastery WHERE studentId = ? AND skillId = ?", studentId, skillId);
      return r && toMastery(r);
    },
    /** Every mastery row of one student, or of every student in a class, in one read. */
    async listMastery(f: { studentId: string } | { classId: string }): Promise<MasteryRow[]> {
      const rows =
        "studentId" in f
          ? await all("SELECT * FROM mastery WHERE studentId = ?", f.studentId)
          : await all("SELECT m.* FROM mastery m JOIN students s ON s.id = m.studentId WHERE s.classId = ?", f.classId);
      return rows.map(toMastery);
    },
    /** Writes mastery rows and their event log lines in one round trip, all or nothing. */
    async writeMastery(rows: MasteryRow | MasteryRow[], events: EventInput[] = []) {
      await writeBatch([
        ...[rows].flat().map((m) => ({
          sql: `INSERT INTO mastery (studentId, skillId, state, evidenceJson, version, updatedAt) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (studentId, skillId) DO UPDATE SET
           state = excluded.state, evidenceJson = excluded.evidenceJson, version = excluded.version, updatedAt = excluded.updatedAt`,
          args: [m.studentId, m.skillId, m.state, m.evidenceJson, m.version, m.updatedAt] as InValue[],
        })),
        ...events.map(eventStatement),
      ]);
    },

    // ----- unknown errors (input for the Misconception Miner) -----
    async recordUnknownError(skillId: string, paramsJson: string, wrongAnswer: string) {
      await write(
        `INSERT INTO unknownErrors (skillId, paramsJson, wrongAnswer, count) VALUES (?, ?, ?, 1)
         ON CONFLICT (skillId, paramsJson, wrongAnswer) DO UPDATE SET count = count + 1`,
        skillId, paramsJson, wrongAnswer,
      );
    },
    async listUnknownErrors(skillId: string): Promise<UnknownErrorRow[]> {
      return (await all("SELECT * FROM unknownErrors WHERE skillId = ? ORDER BY count DESC, id", skillId)).map((r) => ({
        id: Number(r.id),
        skillId: r.skillId as string,
        paramsJson: r.paramsJson as string,
        wrongAnswer: r.wrongAnswer as string,
        count: Number(r.count),
      }));
    },

    // ----- mined mistakes (drafts from the Misconception Miner, decided by a teacher) -----
    async insertMinedMistake(m: MinedMistakeRow) {
      await write(
        "INSERT INTO minedMistakes (id, skillId, source, testsJson, status, approver, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        m.id, m.skillId, m.source, m.testsJson, m.status, m.approver, m.createdAt,
      );
    },
    async listMinedMistakes(status: MinedStatus, skillId?: string): Promise<MinedMistakeRow[]> {
      return (
        await all(
          "SELECT * FROM minedMistakes WHERE status = ? AND (? IS NULL OR skillId = ?) ORDER BY createdAt, id",
          status, skillId ?? null, skillId ?? null,
        )
      ).map(toMined);
    },
    async getMinedMistake(id: string): Promise<MinedMistakeRow | undefined> {
      const r = await one("SELECT * FROM minedMistakes WHERE id = ?", id);
      return r && toMined(r);
    },
    /** Approve or reject a tested draft (optionally saving the teacher's edited JSON). False if it was not a draft any more. */
    decideMinedMistake(id: string, status: "APPROVED" | "REJECTED", approver: string, source?: string): Promise<boolean> {
      return changed(
        "UPDATE minedMistakes SET status = ?, approver = ?, source = COALESCE(?, source) WHERE id = ? AND status = 'DRAFT_TESTED'",
        status, approver, source ?? null, id,
      );
    },

    // ----- events (pilot metrics) -----
    async logEvent(studentId: string | null, type: string, payload: unknown, at: string) {
      await write(
        "INSERT INTO events (studentId, type, payloadJson, createdAt) VALUES (?, ?, ?, ?)",
        studentId, type, JSON.stringify(payload ?? {}), at,
      );
    },
    async listEvents(): Promise<EventRow[]> {
      return (await all("SELECT * FROM events ORDER BY id")).map((r) => ({
        id: Number(r.id),
        studentId: (r.studentId as string | null) ?? null,
        type: r.type as string,
        payloadJson: r.payloadJson as string,
        createdAt: r.createdAt as string,
      }));
    },

    // ----- pilot export: counts only -----
    async exportCounts(classId: string): Promise<ExportCounts[]> {
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
      for (const r of await all(
        `SELECT i.skillId, COUNT(*) AS n, SUM(a.correct) AS ok, SUM(a.mistakeId = 'unknown') AS unk
         FROM attempts a JOIN items i ON i.id = a.itemId JOIN students s ON s.id = a.studentId
         WHERE s.classId = ? AND i.kind = 'practice' GROUP BY i.skillId`,
        classId,
      )) Object.assign(get(r.skillId as string), { practiceAnswers: Number(r.n), practiceCorrect: Number(r.ok), unknownWrongAnswers: Number(r.unk) });
      for (const r of await all(
        `SELECT i.skillId, COUNT(*) AS n, SUM(t.lineCorrect AND t.fixAccepted) AS ok
         FROM teachTraces t JOIN items i ON i.id = t.itemId JOIN students s ON s.id = t.studentId
         WHERE s.classId = ? GROUP BY i.skillId`,
        classId,
      )) Object.assign(get(r.skillId as string), { teachTries: Number(r.n), teachFixes: Number(r.ok) });
      for (const r of await all(
        `SELECT p.skillId, COUNT(*) AS n, SUM(p.passed) AS ok
         FROM proofRuns p JOIN students s ON s.id = p.studentId
         WHERE s.classId = ? AND p.finishedAt IS NOT NULL GROUP BY p.skillId`,
        classId,
      )) Object.assign(get(r.skillId as string), { proofRuns: Number(r.n), proofsPassed: Number(r.ok) });
      for (const r of await all(
        `SELECT m.skillId, SUM(m.state IN ('KEY1', 'NOT_YET', 'MASTERED')) AS k, SUM(m.state = 'MASTERED') AS mm
         FROM mastery m JOIN students s ON s.id = m.studentId WHERE s.classId = ? GROUP BY m.skillId`,
        classId,
      )) Object.assign(get(r.skillId as string), { studentsKey1: Number(r.k), studentsMastered: Number(r.mm) });
      return [...bySkill.values()].sort((a, b) => a.skillId.localeCompare(b.skillId));
    },

    /** Every column of every table (used by the privacy test). */
    async listColumns(): Promise<{ table: string; column: string }[]> {
      const tables = await all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
      const out: { table: string; column: string }[] = [];
      for (const t of tables) {
        for (const c of await all(`PRAGMA table_info(${t.name as string})`)) out.push({ table: t.name as string, column: c.name as string });
      }
      return out;
    },
  };
}

export type Store = Awaited<ReturnType<typeof openStore>>;
