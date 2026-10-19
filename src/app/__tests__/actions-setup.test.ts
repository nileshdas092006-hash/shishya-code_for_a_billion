import { createClient } from "@libsql/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createServices, type Services } from "@/server/services";
import { openStore, type Store } from "@/server/store";
import { SetupError } from "@/server/instance";
import { tempDbUrl } from "@/server/__tests__/helpers";

// A server that is missing SESSION_SECRET: the actions must refuse cleanly, write nothing, and never show the cause.

const missing = () => new SetupError("SESSION_SECRET", "SESSION_SECRET (32+ characters) must be set in production.");
const db: { url?: string; store?: Store; svc?: Services; cleanup?: () => void } = {};

vi.mock("@/server/instance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/instance")>()),
  getServices: async () => db.svc!,
  requireSetup: () => {
    throw missing();
  },
}));
vi.mock("../_lib/auth", () => ({
  addTeacherClass: vi.fn(),
  startStudentSession: vi.fn(),
  endStudentSession: vi.fn(),
  currentStudent: vi.fn(async () => {
    throw missing();
  }),
  teacherClass: vi.fn(async () => {
    throw missing();
  }),
}));

const auth = await import("../_lib/auth");
const actions = await import("../actions");

beforeAll(async () => {
  const { url, cleanup } = tempDbUrl();
  db.url = url;
  db.store = await openStore({ url });
  db.svc = createServices(db.store, {
    checkSetup: () => {
      throw missing();
    },
  });
  db.cleanup = cleanup;
});
afterAll(() => {
  db.store?.close();
  db.cleanup?.();
});
afterEach(() => vi.restoreAllMocks());

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("server actions when a setting is missing", () => {
  it("creating a class writes nothing, sets no cookie and shows a friendly message (cause in the server log only)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await actions.createClassAction({ status: "idle" }, form({ grade: "8", section: "Q", studentCount: "3" }));
    expect(out).toEqual({ status: "error", message: "Shishya is not set up yet: the server is missing a setting. Ask the person who set it up to check the settings." });
    expect(JSON.stringify(out)).not.toContain("SESSION_SECRET");
    expect(auth.addTeacherClass).not.toHaveBeenCalled();
    expect(String(log.mock.calls.flat().join(" "))).toContain("SESSION_SECRET");
    const client = createClient({ url: db.url! });
    expect(Number((await client.execute("SELECT COUNT(*) AS n FROM classes")).rows[0].n)).toBe(0);
    client.close();
  });

  it("a student log-in says Shishya is not set up yet (no crash)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await actions.loginStudent({}, form({ classCode: "8Q-AAAA", studentCode: "8Q-01" }))).toEqual({ error: "setup.missing" });
    expect(auth.startStudentSession).not.toHaveBeenCalled();
  });

  it("a teacher PIN log-in says Shishya is not set up yet (no crash)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await actions.teacherLogin({}, form({ classCode: "8Q-AAAA", pin: "123456" }));
    expect(out.error).toMatch(/^Shishya is not set up yet/);
  });

  it("student and teacher actions refuse as 'not logged in' instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await actions.servePractice("alg.linear.both-sides")).toEqual({ ok: false, code: "auth" });
    expect(await actions.projectorNew("8Q-AAAA", "alg.linear.both-sides")).toEqual({ ok: false, code: "auth" });
    await expect(actions.unlockSkillForClass("8Q-AAAA", "alg.linear.both-sides")).resolves.toBeUndefined();
  });
});
