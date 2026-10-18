import { describe, expect, it } from "vitest";
import { canShowAiChat } from "../policy";
import { signSession, verifySession } from "../session";

const SECRET = "test-secret-test-secret-test-secret";

describe("signed sessions", () => {
  const now = Date.parse("2026-10-20T09:00:00Z");
  const payload = { kind: "student" as const, studentId: "s1", exp: now + 3600_000 };

  it("round-trips a signed payload", () => {
    expect(verifySession(signSession(payload, SECRET), SECRET, now)).toEqual(payload);
  });

  it("rejects a changed payload, a wrong secret, an expired token and junk", () => {
    const token = signSession(payload, SECRET);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, studentId: "s2" })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, SECRET, now)).toBeNull();
    expect(verifySession(`${body}.${sig}`, "another-secret-another-secret-xx", now)).toBeNull();
    expect(verifySession(token, SECRET, now + 2 * 3600_000)).toBeNull();
    for (const junk of ["", "abc", "a.b", "..", undefined]) expect(verifySession(junk, SECRET, now)).toBeNull();
  });
});

describe("AI chat policy", () => {
  it("Class 7 (under 13) never gets an AI chat, even when the tutor is switched on", () => {
    expect(canShowAiChat({ grade: 7, aiAllowed: false }, { aiTutorEnabled: true })).toBe(false);
    expect(canShowAiChat({ grade: 7, aiAllowed: true }, { aiTutorEnabled: true })).toBe(false);
  });

  it("Class 8–9 only when the tutor is switched on (it is off by default)", () => {
    expect(canShowAiChat({ grade: 8, aiAllowed: true }, { aiTutorEnabled: false })).toBe(false);
    expect(canShowAiChat({ grade: 8, aiAllowed: true }, { aiTutorEnabled: true })).toBe(true);
    expect(canShowAiChat({ grade: 9, aiAllowed: false }, { aiTutorEnabled: true })).toBe(false);
    expect(canShowAiChat({ grade: 8, aiAllowed: true })).toBe(false);
  });
});
