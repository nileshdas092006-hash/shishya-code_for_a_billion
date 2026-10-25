import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Signed session tokens for cookies: base64url(JSON) + "." + HMAC-SHA256. No library needed.
// A token only names a student id or the class ids a teacher unlocked with a PIN; it holds no personal data.

export type StudentSession = { kind: "student"; studentId: string; exp: number };
export type TeacherSession = { kind: "teacher"; classIds: string[]; exp: number };
export type Session = StudentSession | TeacherSession;

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function signSession(payload: Session, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/**
 * The payload if the token is genuine and not expired, else null. Never throws. With several secrets (rotation:
 * the current one first, then the previous one), a token signed with any of them is genuine.
 */
export function verifySession(token: string | undefined, secret: string | string[], now = Date.now()): Session | null {
  try {
    if (!token) return null;
    const [body, sig, extra] = token.split(".");
    if (!body || !sig || extra !== undefined) return null;
    const given = Buffer.from(sig);
    const signedWith = (s: string) => {
      const expected = Buffer.from(sign(body, s));
      return expected.length === given.length && timingSafeEqual(expected, given);
    };
    if (![secret].flat().some(signedWith)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/** SESSION_SECRET from the environment, or a random secret kept in a file next to the database. */
export function loadSessionSecret(secretFile: string, env: Record<string, string | undefined> = process.env): string {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 32) return env.SESSION_SECRET;
  if (existsSync(secretFile)) return readFileSync(secretFile, "utf8").trim();
  mkdirSync(dirname(secretFile), { recursive: true });
  const secret = randomBytes(32).toString("base64url");
  writeFileSync(secretFile, secret, { mode: 0o600 });
  return secret;
}
