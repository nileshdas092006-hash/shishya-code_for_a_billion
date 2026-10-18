import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

/** A fresh database file in a temporary folder, for one test. */
export function tempDbFile(): { file: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "shishya-test-"));
  return { file: join(dir, "test.db"), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export function setup(opts: Omit<ServiceOptions, "now"> = {}) {
  const { file, cleanup } = tempDbFile();
  const store = openStore(file);
  const clock = makeClock();
  const svc = createServices(store, { cooldownHours: 24, ...opts, now: clock.now });
  const cls = svc.createClass("KV8B", 8);
  const student = svc.createStudent(cls.id, "8B-17");
  let closed = false;
  return {
    file,
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
export function correctFix(store: Store, itemId: string): { line: number; text: string; wrongText: string } {
  const item = store.getItem(itemId)!;
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
export function teachPerfectly(svc: Svc, store: Store, studentId: string) {
  const session = svc.startTeach(studentId, SKILL);
  if (!session.ok) throw new Error(session.reason);
  let last;
  for (const t of session.traces) {
    const fix = correctFix(store, t.itemId);
    last = svc.submitTeachStep(t.itemId, fix.line, fix.text);
  }
  return { session, last: last! };
}

/** Answers every proof item; the item at wrongIndex (if any) gets a wrong answer. */
export function answerProof(svc: Svc, store: Store, itemIds: string[], wrongIndex = -1) {
  let last;
  itemIds.forEach((id, i) => {
    const answer = store.getItem(id)!.answer;
    last = svc.submitProofAnswer(id, i === wrongIndex ? `${answer}01` : answer);
  });
  return last!;
}
