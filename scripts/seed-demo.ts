// npm run seed:demo
// Creates a DEMO class, 5 demo students and some fake practice answers, ONLY in data/demo.db.
// It refuses any other database, so demo data can never mix with pilot data (data/shishya.db or Turso).
// Run the app on it with: npm run dev:demo (every page then shows a DEMO banner).

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { answerText } from "../src/core/answer";
import { createRng } from "../src/core/rng";
import { getSkillEntry } from "../src/core/skills";
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
// The demo practice answers are for "variables on both sides" (the first skill, integers, is open to everyone).
const { spec } = getSkillEntry("alg.linear.both-sides")!;

const room = await svc.createClassroom({ grade: 8, section: "D", studentCount: 5, pin: DEMO_PIN });
await svc.recordConsent(room.classId, { allowed: true, slips: 5 }); // as the teacher does on the board; children log in after this
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
    kind === "correct" ? answerText(instance.answer) : mistake ? answerText(mistake.apply(instance).answer) : answerText(instance.answer) + "9";
  await svc.submitPracticeAnswer(served.itemId, answer);
}

// one plan per demo student, in the order of their (random) codes
const plan: string[][] = [
  ["kept-x-sign", "kept-x-sign", "kept-x-sign", "correct"],
  ["kept-x-sign", "kept-x-sign", "correct", "correct"],
  ["dropped-constant", "dropped-constant", "kept-x-sign"],
  ["kept-const-sign", "forgot-to-divide", "kept-const-sign"],
  ["made-up", "correct", "correct", "correct"],
];
let answers = 0;
for (const [i, kinds] of plan.entries()) {
  const code = room.studentCodes[i];
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
