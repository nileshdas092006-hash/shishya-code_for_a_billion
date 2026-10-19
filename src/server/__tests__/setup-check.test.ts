import { describe, expect, it } from "vitest";
import { checkSetup, databaseConfig, isSetupError, SetupError, sessionSecretFrom } from "../instance";

const SECRET = "s".repeat(32);

describe("server settings check (production needs SESSION_SECRET and DATABASE_URL)", () => {
  it("passes in production when both settings are there", () => {
    expect(checkSetup({ NODE_ENV: "production", SESSION_SECRET: SECRET, DATABASE_URL: "libsql://x.turso.io" })).toEqual({ ok: true });
  });

  it("names every missing or invalid setting, never its value", () => {
    const r = checkSetup({ NODE_ENV: "production", SESSION_SECRET: "too-short-secret" });
    expect(r).toEqual({ ok: false, missing: ["SESSION_SECRET", "DATABASE_URL"] });
    expect(JSON.stringify(r)).not.toContain("too-short-secret");
    expect(checkSetup({ NODE_ENV: "production", DATABASE_URL: "libsql://x" })).toEqual({ ok: false, missing: ["SESSION_SECRET"] });
  });

  it("passes on a laptop (local fallbacks are used there)", () => {
    expect(checkSetup({ NODE_ENV: "development" })).toEqual({ ok: true });
  });

  it("a missing secret or database is a SetupError, so pages can show a friendly message", () => {
    let caught: unknown;
    try {
      sessionSecretFrom({ NODE_ENV: "production", SESSION_SECRET: "short" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SetupError);
    expect(isSetupError(caught)).toBe(true);
    expect((caught as SetupError).setting).toBe("SESSION_SECRET");
    expect((caught as Error).message).not.toContain("short");
    expect(sessionSecretFrom({ NODE_ENV: "production", SESSION_SECRET: ` ${SECRET} ` })).toBe(SECRET);
    expect(isSetupError(captured(() => databaseConfig({ NODE_ENV: "production" })))).toBe(true);
    expect(isSetupError(new Error("other"))).toBe(false);
  });
});

function captured(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
}
