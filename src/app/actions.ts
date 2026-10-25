"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getSkillEntry } from "@/core/skills";
import type { MessageKey } from "@/i18n";
import { getServices, isSetupError, requireSetup } from "@/server/instance";
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
  if (!result.ok) return { error: result.code === "locked_out" ? "login.tooMany" : "login.wrong" };
  await startStudentSession(result.studentId);
  redirect("/s/home");
}

export async function logoutStudent() {
  await endStudentSession();
  redirect("/s");
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
  | { status: "created"; classCode: string; pin: string; studentCodes: string[]; grade: number; section: string };

export async function createClassAction(_prev: CreateClassState, form: FormData): Promise<CreateClassState> {
  try {
    const grade = Number(form.get("grade"));
    const section = str(form.get("section"), 2);
    const studentCount = Number(form.get("studentCount"));
    const room = await (await getServices()).createClassroom({ grade, section, studentCount });
    await addTeacherClass(room.classId);
    return { status: "created", classCode: room.classCode, pin: room.pin, studentCodes: room.studentCodes, grade, section: section.toUpperCase() };
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
