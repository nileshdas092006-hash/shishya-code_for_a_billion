"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getSkillEntry } from "@/core/skills";
import type { MessageKey } from "@/i18n";
import { getServices, isSetupError, requireSetup } from "@/server/instance";
import { COOLDOWN_CHOICES, type CooldownChoice } from "@/server/services";
import { logServerError } from "@/server/setup";
import { SETUP_MISSING_TEACHER } from "./_lib/page-guard";
import {
  addTeacherClass,
  currentStudent,
  endStudentSession,
  startStudentSession,
  teacherClass,
} from "./_lib/auth";

// Server actions: the ONLY way the screens reach the server. Every action works out who is calling from the
// signed cookie (never from what the browser sends), checks the item belongs to that student, and then calls
// src/server/services.ts. Mastery is decided inside the services by src/server/mastery.ts, never here.

type NotAllowed = { ok: false; code: "auth" | "not_found" };
const notAllowed = (code: NotAllowed["code"] = "auth"): NotAllowed => ({ ok: false, code });

const str = (v: unknown, max = 200) => String(v ?? "").slice(0, max);
const knownSkill = (skillId: unknown) => (getSkillEntry(str(skillId)) ? str(skillId) : null);

// A missing server setting must never crash a screen: the cause goes to the server log, and the caller
// is treated as not logged in (or gets a friendly "not set up yet" message).
async function orNullIfNotSetUp<T>(where: string, read: () => Promise<T | null>): Promise<T | null> {
  try {
    return await read();
  } catch (e) {
    if (!isSetupError(e)) throw e;
    logServerError(where, e);
    return null;
  }
}

const studentOrNull = () => orNullIfNotSetUp("student action", currentStudent);
const classOrNull = (classCode: unknown) => orNullIfNotSetUp("teacher action", () => teacherClass(str(classCode, 20)));

/** Checks the server settings before a log-in; a friendly message instead of a crash when one is missing. */
function notSetUp(where: string): boolean {
  try {
    requireSetup();
    return false;
  } catch (e) {
    logServerError(where, e);
    return true;
  }
}

async function ownedItem(itemId: unknown) {
  const student = await studentOrNull();
  const id = str(itemId);
  if (!student || (await (await getServices()).getItemOwner(id)) !== student.studentId) return null;
  return id;
}

// ---------------- student: log in / out ----------------

export async function loginStudent(_prev: { error?: MessageKey }, form: FormData): Promise<{ error?: MessageKey }> {
  if (notSetUp("student login")) return { error: "setup.missing" };
  const result = await (await getServices()).studentLogin(str(form.get("classCode"), 20), str(form.get("studentCode"), 20));
  if (!result.ok) {
    return { error: result.code === "locked_out" ? "login.tooMany" : result.code === "consent_needed" ? "login.consentNeeded" : "login.wrong" };
  }
  await startStudentSession(result.studentId);
  redirect("/s/home");
}

export async function logoutStudent() {
  await endStudentSession();
  redirect("/s");
}

// ---------------- the Judge Tour (a made-up sandbox class, deleted after 24 hours) ----------------

/** Starts a tour and logs this browser in as the tour's child AND the tour class's teacher (no PIN). */
export async function startJudgeTour(): Promise<{ error?: MessageKey }> {
  if (notSetUp("judge tour")) return { error: "setup.missing" };
  const tour = await (await getServices()).startTour();
  if (!tour.ok) return { error: "tour.busy" };
  await startStudentSession(tour.studentId);
  await addTeacherClass(tour.classId);
  redirect("/tour/1");
}

/** Stop 3: finishes the tour child's teaching through the real teach code (refused outside a tour), then the proof. */
export async function skipAheadInTour() {
  const student = await studentOrNull();
  if (student) await (await getServices()).tourSkipAhead(student.studentId);
  redirect("/tour/3");
}

// ---------------- student: practise ----------------

export async function servePractice(skillId: string) {
  const student = await studentOrNull();
  const skill = knownSkill(skillId);
  if (!student) return notAllowed();
  if (!skill) return notAllowed("not_found");
  return (await getServices()).servePracticeItem(student.studentId, skill);
}

export async function answerPractice(itemId: string, answer: string) {
  const id = await ownedItem(itemId);
  if (!id) return notAllowed();
  return (await getServices()).submitPracticeAnswer(id, str(answer, 40));
}

// ---------------- student: teach the Shishya ----------------

export async function startTeachSession(skillId: string) {
  const student = await studentOrNull();
  const skill = knownSkill(skillId);
  if (!student) return notAllowed();
  if (!skill) return notAllowed("not_found");
  return (await getServices()).startTeach(student.studentId, skill);
}

export async function submitTeach(itemId: string, tappedLine: number, typedLine: string) {
  const id = await ownedItem(itemId);
  if (!id) return notAllowed();
  const line = Number(tappedLine);
  if (!Number.isInteger(line) || line < 1 || line > 10) return notAllowed("not_found");
  return (await getServices()).submitTeachStep(id, line, str(typedLine, 80));
}

// ---------------- student: prove it (no AI help; opens when the teacher opens it) ----------------

export async function proofOverview(skillId: string) {
  const student = await studentOrNull();
  const skill = knownSkill(skillId);
  if (!student) return notAllowed();
  if (!skill) return notAllowed("not_found");
  const svc = await getServices();
  const resume = await svc.resumeProof(student.studentId, skill);
  return { ok: true as const, resume: resume.ok ? resume : null, status: await svc.proofStatus(student.studentId, skill) };
}

export async function startProofRun(skillId: string) {
  const student = await studentOrNull();
  const skill = knownSkill(skillId);
  if (!student) return notAllowed();
  if (!skill) return notAllowed("not_found");
  return (await getServices()).startProof(student.studentId, skill);
}

export async function submitProof(itemId: string, answer: string) {
  const id = await ownedItem(itemId);
  if (!id) return notAllowed();
  return (await getServices()).submitProofAnswer(id, str(answer, 40));
}

// ---------------- teacher ----------------

export type CreateClassState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "created"; classCode: string; pin: string; recoveryCode: string; studentCodes: string[]; grade: number; section: string };

export async function createClassAction(_prev: CreateClassState, form: FormData): Promise<CreateClassState> {
  try {
    const grade = Number(form.get("grade"));
    const section = str(form.get("section"), 2);
    const studentCount = Number(form.get("studentCount"));
    const room = await (await getServices()).createClassroom({ grade, section, studentCount });
    await addTeacherClass(room.classId);
    return {
      status: "created",
      classCode: room.classCode,
      pin: room.pin,
      recoveryCode: room.recoveryCode,
      studentCodes: room.studentCodes,
      grade,
      section: section.toUpperCase(),
    };
  } catch (e) {
    if (isSetupError(e)) {
      logServerError("create class", e);
      return { status: "error", message: SETUP_MISSING_TEACHER };
    }
    return { status: "error", message: e instanceof Error ? e.message : "Could not create the class." };
  }
}

export async function teacherLogin(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  if (notSetUp("teacher login")) return { error: SETUP_MISSING_TEACHER };
  const classCode = str(form.get("classCode"), 20);
  const result = await (await getServices()).verifyTeacherPin(classCode, str(form.get("pin"), 12));
  if (!result.ok) return { error: result.reason };
  await addTeacherClass(result.classId);
  const cls = (await (await getServices()).getClass(result.classId))!;
  redirect(`/teacher/${encodeURIComponent(cls.code)}`);
}

export type RecoverPinState =
  | { status: "idle" }
  | { status: "error"; error: MessageKey; classCode: string }
  | { status: "done"; classCode: string; pin: string; recoveryCode: string };

/** "Forgot the PIN?": class code + recovery code → a new PIN and a new recovery code (shown once); this browser opens the class. */
export async function recoverPinAction(_prev: RecoverPinState, form: FormData): Promise<RecoverPinState> {
  const classCode = str(form.get("classCode"), 20);
  if (notSetUp("PIN recovery")) return { status: "error", error: "setup.missing", classCode };
  const result = await (await getServices()).recoverTeacherPin(classCode, str(form.get("recoveryCode"), 30));
  if (!result.ok) {
    const error: MessageKey = result.code === "locked_out" ? "recover.tooMany" : result.code === "no_recovery" ? "recover.none" : "recover.wrong";
    return { status: "error", error, classCode }; // the class code stays typed in; only the recovery code is cleared
  }
  await addTeacherClass(result.classId);
  return { status: "done", classCode: result.classCode, pin: result.pin, recoveryCode: result.recoveryCode };
}

const boardOf = (classCode: string) => `/teacher/${encodeURIComponent(classCode)}`;

/** "Before children log in": the school has allowed this class and parents have been told; the parent slips received. */
export async function recordConsentAction(classCode: string, form: FormData) {
  const cls = await classOrNull(classCode);
  if (!cls) return;
  const slips = str(form.get("slips"), 6).trim();
  let saved = true;
  try {
    await (await getServices()).recordConsent(cls.id, { allowed: form.get("allowed") === "on", slips: slips === "" ? NaN : Number(slips) });
  } catch (e) {
    if (isSetupError(e)) throw e;
    saved = false; // the box was not ticked, or the number of slips is not a whole number
  }
  if (!saved) redirect(`${boardOf(cls.code)}?consent=check#consent`);
  refresh();
}

/** "After a missed proof, the next try opens": 24, 1 or 0 hours, for this class. */
export async function setCooldownAction(classCode: string, form: FormData) {
  const cls = await classOrNull(classCode);
  const hours = Number(str(form.get("hours"), 3));
  if (!cls || !(COOLDOWN_CHOICES as readonly number[]).includes(hours)) return;
  await (await getServices()).setProofCooldown(cls.id, hours as CooldownChoice);
  refresh();
}

/** Deletes the class and all its data, only if the teacher typed this class's code. */
export async function deleteClassAction(classCode: string, form: FormData) {
  const cls = await classOrNull(classCode);
  if (!cls) redirect("/teacher");
  const result = await (await getServices()).deleteClass(cls.id, str(form.get("confirmCode"), 20));
  if (!result.ok && result.code === "confirm_mismatch") redirect(`${boardOf(cls.code)}/delete?wrong=1`);
  redirect("/teacher/deleted");
}

export async function unlockSkillForClass(classCode: string, skillId: string) {
  const cls = await classOrNull(classCode);
  const skill = knownSkill(skillId);
  if (!cls || !skill) return;
  await (await getServices()).teacherUnlockClass(cls.id, skill);
  refresh();
}

export async function decideMined(
  classCode: string,
  id: string,
  decision: "approved" | "rejected",
  edits?: { label?: string; childLabel?: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const cls = await classOrNull(classCode);
  if (!cls || (decision !== "approved" && decision !== "rejected")) return { ok: false, reason: "Enter the class PIN first." };
  const clean = edits && {
    ...(typeof edits.label === "string" ? { label: str(edits.label, 300) } : {}),
    ...(typeof edits.childLabel === "string" ? { childLabel: str(edits.childLabel, 300) } : {}),
  };
  const result = await (await getServices()).decideMinedMistake(cls.id, str(id, 64), decision, clean);
  if (result.ok) refresh();
  return result;
}

export async function projectorNew(classCode: string, skillId: string) {
  const cls = await classOrNull(classCode);
  const skill = knownSkill(skillId);
  if (!cls) return notAllowed();
  if (!skill) return notAllowed("not_found");
  return { ok: true as const, ...(await (await getServices()).projectorTrace(cls.id, skill)) };
}

export async function projectorCheckLine(
  classCode: string,
  skillId: string,
  seed: number,
  mistakeId: string,
  tappedLine: number,
  typedLine: string,
) {
  const cls = await classOrNull(classCode);
  const skill = knownSkill(skillId);
  if (!cls) return notAllowed();
  if (!skill) return notAllowed("not_found");
  return { ok: true as const, ...(await (await getServices()).projectorCheck(cls.id, skill, Number(seed), str(mistakeId, 64), Number(tappedLine), str(typedLine, 80))) };
}

export async function openProofs(classCode: string) {
  const cls = await classOrNull(classCode);
  if (!cls) return;
  await (await getServices()).openProofWindow(cls.id);
  refresh();
}

export async function closeProofs(classCode: string) {
  const cls = await classOrNull(classCode);
  if (!cls) return;
  await (await getServices()).closeProofWindow(cls.id);
  refresh();
}

/** Every child in the class gets a new random code (progress is kept); the board then shows the new list to print. */
export async function giveNewCodes(classCode: string) {
  const cls = await classOrNull(classCode);
  if (!cls) return;
  await (await getServices()).reissueStudentCodes(cls.id);
  redirect(`/teacher/${encodeURIComponent(cls.code)}?codes=new#codes`);
}

// ---------------- teacher: Paper Mode (a printed worksheet; the teacher types in each child's final answer) ----------------

/** "Make the worksheet": a skill and 1 to 20 questions; then the worksheet's own page (print it, type in answers). */
export async function createWorksheetAction(classCode: string, form: FormData) {
  const cls = await classOrNull(classCode);
  if (!cls) redirect("/teacher");
  const skill = knownSkill(form.get("skill"));
  const count = Number(str(form.get("count"), 3));
  const made = skill ? await (await getServices()).createWorksheet(cls.id, skill, count) : null;
  if (!made?.ok) redirect(`${boardOf(cls.code)}/paper?bad=1`);
  redirect(`${boardOf(cls.code)}/paper/${encodeURIComponent(made.worksheet.code)}`);
}

export type PaperSaveState =
  | { status: "idle"; round: 0 }
  | { status: "error"; error: MessageKey; round: number }
  | {
      status: "saved";
      saved: number;
      correct: number;
      already: number;
      unreadable: { studentCode: string; question: number; text: string }[];
      round: number;
    };

/** The answer grid: boxes named c:<child code>:<question>. An empty box is not answered. */
export async function savePaperAction(classCode: string, sheetCode: string, prev: PaperSaveState, form: FormData): Promise<PaperSaveState> {
  const round = prev.round + 1;
  const cls = await classOrNull(classCode);
  if (!cls) return { status: "error", error: "paper.grid.auth", round };
  const entries = [];
  for (const [name, value] of form.entries()) {
    const m = /^c:([A-Z0-9-]{1,20}):(\d{1,2})$/.exec(name);
    if (m && typeof value === "string" && value.trim() !== "") entries.push({ studentCode: m[1], question: Number(m[2]), text: str(value, 40) });
    if (entries.length >= 1500) break; // 60 children × 20 questions at most
  }
  const out = await (await getServices()).savePaperAnswers(cls.id, str(sheetCode, 20), entries);
  if (!out.ok) return { status: "error", error: out.code === "old_version" ? "paper.sheet.old" : "paper.grid.busy", round };
  refresh();
  return {
    status: "saved",
    saved: out.saved,
    correct: out.correct,
    already: out.alreadySaved.length,
    unreadable: out.unreadable.map(({ studentCode, question, text }) => ({ studentCode, question, text })),
    round,
  };
}
