import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRng } from "../../core/rng";
import { linearBothSides } from "../../core/skills/linear-both-sides";
import { createServices, type ServiceOptions } from "../services";
import { openStore, type Store } from "../store";

export const SKILL = "alg.linear.both-sides";

export type Clock = { t: number; now: () => Date; advanceHours(h: number): void; advanceMinutes(m: number): void };

export function makeClock(start = Date.parse("2026-10-20T09:00:00Z")): Clock {
  const clock: Clock = {
    t: start,
    now: () => new Date(clock.t),
    advanceHours: (h) => void (clock.t += h * 3600_000),
    advanceMinutes: (m) => void (clock.t += m * 60_000),
  };
  return clock;
}

// Test databases live under one folder in the system temp directory. On Windows, libSQL keeps a database file
// open until the process exits (even after close()), so a test cannot always delete its own folder; instead,
// each run removes folders left by earlier runs (older than an hour, so never another worker's live folder).
const TEST_ROOT = join(tmpdir(), "shishya-tests");
const removeQuietly = (dir: string) => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // still open (Windows): a later run removes it
  }
};
let swept = false;
function sweepOldFolders() {
  if (swept) return;
  swept = true;
  mkdirSync(TEST_ROOT, { recursive: true });
  for (const name of readdirSync(TEST_ROOT)) {
    const dir = join(TEST_ROOT, name);
    if (Date.now() - statSync(dir).mtimeMs > 3600_000) removeQuietly(dir);
  }
}

/** A fresh database (a file: URL in a temporary folder), for one test. */
export function tempDbUrl(): { url: string; cleanup: () => void } {
  sweepOldFolders();
  const dir = mkdtempSync(join(TEST_ROOT, "t-"));
  return { url: pathToFileURL(join(dir, "test.db")).href, cleanup: () => removeQuietly(dir) };
}

export async function setup(opts: Omit<ServiceOptions, "now"> = {}) {
  const { url, cleanup } = tempDbUrl();
  const store = await openStore({ url });
  const clock = makeClock();
  const svc = createServices(store, { cooldownHours: 24, ...opts, now: clock.now });
  const cls = await svc.createClass("KV8B", 8);
  const student = await svc.createStudent(cls.id, "8B-17");
  let closed = false;
  return {
    url,
    store,
    clock,
    svc,
    cls,
    student,
    done() {
      if (closed) return;
      closed = true;
      store.close();
      cleanup();
    },
  };
}

/** The correct line the child should type to fix a teach item. */
export async function correctFix(store: Store, itemId: string): Promise<{ line: number; text: string; wrongText: string }> {
  const item = (await store.getItem(itemId))!;
  const inst = linearBothSides.generate(createRng(item.seed));
  const m = linearBothSides.mistakes.find((x) => x.id === item.mistakeId)!;
  const out = m.apply(inst);
  return {
    line: out.firstWrongLine,
    text: linearBothSides.solve(inst).trace[out.firstWrongLine - 1].text,
    wrongText: out.trace[out.firstWrongLine - 1].text,
  };
}

type Svc = ReturnType<typeof createServices>;

/** Runs one teach session, fixing every trace correctly on the first try. */
export async function teachPerfectly(svc: Svc, store: Store, studentId: string) {
  const session = await svc.startTeach(studentId, SKILL);
  if (!session.ok) throw new Error(session.reason);
  let last;
  for (const t of session.traces) {
    const fix = await correctFix(store, t.itemId);
    last = await svc.submitTeachStep(t.itemId, fix.line, fix.text);
  }
  return { session, last: last! };
}

/** Answers every proof item; the item at wrongIndex (if any) gets a wrong answer. */
export async function answerProof(svc: Svc, store: Store, itemIds: string[], wrongIndex = -1) {
  let last;
  for (const [i, id] of itemIds.entries()) {
    const answer = (await store.getItem(id))!.answer;
    last = await svc.submitProofAnswer(id, i === wrongIndex ? `${answer}01` : answer);
  }
  return last!;
}
