import { cookies } from "next/headers";
import { connection } from "next/server";
import { getServices, getSessionSecret, getSessionSecrets } from "@/server/instance";
import { signSession, verifySession } from "@/server/session";

// Who is using the app, from signed cookies. Server-side only (pages and server actions).
// Each read first waits for a real request (connection()), so per-child data is never prerendered.

const STUDENT_COOKIE = "shishya_student";
const TEACHER_COOKIE = "shishya_teacher";
const STUDENT_HOURS = 8; // one school day
const TEACHER_DAYS = 30;

const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: maxAgeSeconds,
});

/** The logged-in student (code, class, grade), or null. */
export async function currentStudent() {
  await connection();
  const token = (await cookies()).get(STUDENT_COOKIE)?.value;
  const session = verifySession(token, getSessionSecrets());
  if (!session || session.kind !== "student") return null;
  return (await (await getServices()).getStudentContext(session.studentId)) ?? null;
}

export async function startStudentSession(studentId: string) {
  const exp = Date.now() + STUDENT_HOURS * 3600_000;
  (await cookies()).set(
    STUDENT_COOKIE,
    signSession({ kind: "student", studentId, exp }, getSessionSecret()),
    cookieOptions(STUDENT_HOURS * 3600),
  );
}

export async function endStudentSession() {
  (await cookies()).delete(STUDENT_COOKIE);
}

/** Class ids this browser has unlocked with a teacher PIN. */
export async function teacherClassIds(): Promise<string[]> {
  await connection();
  const token = (await cookies()).get(TEACHER_COOKIE)?.value;
  const session = verifySession(token, getSessionSecrets());
  return session && session.kind === "teacher" ? session.classIds : [];
}

/** The class (by code) if this browser has its PIN, else null. */
export async function teacherClass(classCode: string) {
  const allowed = await teacherClassIds();
  const cls = await (await getServices()).getClassByCode(classCode);
  return cls && allowed.includes(cls.id) ? cls : null;
}

export async function addTeacherClass(classId: string) {
  const classIds = [...new Set([...(await teacherClassIds()), classId])].slice(-10);
  const exp = Date.now() + TEACHER_DAYS * 86_400_000;
  (await cookies()).set(
    TEACHER_COOKIE,
    signSession({ kind: "teacher", classIds, exp }, getSessionSecret()),
    cookieOptions(TEACHER_DAYS * 86_400),
  );
}
