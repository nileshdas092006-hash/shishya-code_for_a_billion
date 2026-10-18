// npm run seed:demo
// Creates a DEMO class, 5 demo students and some fake practice answers, ONLY in data/demo.db.
// It refuses any other database, so demo data can never mix with pilot data (data/shishya.db or Turso).
// Run the app on it with: npm run dev:demo (every page then shows a DEMO banner).

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { toString } from "../src/core/fraction";
import { createRng } from "../src/core/rng";
import { SKILLS } from "../src/core/skills";
import { createServices } from "../src/server/services";
import { openStore } from "../src/server/store";

const DEMO_URL = "file:data/demo.db";
const DEMO_FILE = resolve("data", "demo.db");
const DEMO_PIN = "123456";

if (!DEMO_URL.endsWith("/demo.db") && !DEMO_URL.endsWith(":data/demo.db")) throw new Error("The demo seed only writes to data/demo.db");
for (const suffix of ["", "-wal", "-shm"]) {
  if (existsSync(DEMO_FILE + suffix)) rmSync(DEMO_FILE + suffix);
}

const store = await openStore({ url: DEMO_URL });
const svc = createServices(store, { cooldownHours: 0 });
const { spec } = SKILLS[0];

const room = await svc.createClassroom({ grade: 8, section: "D", studentCount: 5, pin: DEMO_PIN });
await svc.teacherUnlockClass(room.classId, spec.id);

/** One practice answer: a given mistake's wrong answer, a made-up wrong answer, or the right answer. */
async function practise(studentCode: string, kind: string) {
  const login = await svc.studentLogin(room.classCode, studentCode);
  if (!login.ok) throw new Error(login.reason);
  const served = await svc.servePracticeItem(login.studentId, spec.id);
  if (!served.ok) throw new Error(served.reason);
  const item = (await store.getItem(served.itemId))!;
  const instance = spec.generate(createRng(item.seed));
  const mistake = spec.mistakes.find((m) => m.id === kind);
  const answer =
    kind === "correct" ? toString(instance.answer) : mistake ? toString(mistake.apply(instance).answer) : toString(instance.answer) + "9";
  await svc.submitPracticeAnswer(served.itemId, answer);
}

const plan: Record<string, string[]> = {
  "8D-01": ["kept-x-sign", "kept-x-sign", "kept-x-sign", "correct"],
  "8D-02": ["kept-x-sign", "kept-x-sign", "correct", "correct"],
  "8D-03": ["dropped-constant", "dropped-constant", "kept-x-sign"],
  "8D-04": ["kept-const-sign", "forgot-to-divide", "kept-const-sign"],
  "8D-05": ["made-up", "correct", "correct", "correct"],
};
let answers = 0;
for (const [code, kinds] of Object.entries(plan)) {
  for (const kind of kinds) {
    await practise(code, kind);
    answers++;
  }
}
store.close();

console.log(`
DEMO data written to ${DEMO_FILE} (never the pilot database).
  Class code:   ${room.classCode}   (Class 8D, ${room.studentCodes.length} demo students: ${room.studentCodes.join(", ")})
  Teacher PIN:  ${DEMO_PIN}
  Practice answers: ${answers}
Start the app on the demo data with: npm run dev:demo
`);
