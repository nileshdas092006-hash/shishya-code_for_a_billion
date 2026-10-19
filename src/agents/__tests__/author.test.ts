import { describe, expect, it } from "vitest";
import { readPolicy, runAuthor, writePolicy, type AuthorPorts } from "../author";
import { finalAnswer, scriptedModel, toolCall } from "../fake-model";

/** In-memory files and a scripted test runner, instead of a real git worktree. */
function fakePorts(testResults: boolean[]) {
  const files = new Map<string, string>([
    ["src/core/skills/index.ts", "// the registry"],
    ["src/core/skills/integers-ops.ts", "// an example skill"],
    ["src/core/types.ts", "// types"],
  ]);
  let runs = 0;
  const ports: AuthorPorts = {
    listFiles: async (dir) => [...files.keys()].filter((f) => f.startsWith(`${dir}/`)),
    readFile: async (path) => {
      const text = files.get(path);
      if (text === undefined) throw new Error("no such file");
      return text;
    },
    writeFile: async (path, content) => void files.set(path, content),
    exists: async (path) => files.has(path),
    runTests: async () => {
      const passed = testResults[runs++] ?? false;
      return { passed, output: passed ? "Test Files 40 passed" : "FAIL src/core/__tests__/integers-multiply.test.ts\nAssertionError: expected 12 to be -12" };
    },
  };
  return { ports, files, runs: () => runs };
}

const SKILL = "src/core/skills/integers-multiply.ts";
const TEST = "src/core/__tests__/integers-multiply.test.ts";

describe("the Skill Author's write and read rules", () => {
  it("may only create skill files and test files", () => {
    const existing = new Set(["src/core/skills/index.ts"]);
    const created = new Set<string>();
    expect(writePolicy(SKILL, existing, created)).toBeNull();
    expect(writePolicy(TEST, existing, created)).toBeNull();
    for (const bad of [
      "src/core/skills/index.ts", // an existing file: the registry is for Das to change after review
      "src/app/page.tsx",
      "src/server/mastery.ts",
      "src/core/skills/../types.ts",
      "../outside.ts",
      "C:/Windows/x.ts",
      "src\\core\\skills\\x.ts",
      "src/core/skills/Has Space.ts",
      "src/core/__tests__/not-a-test.ts",
      "src/core/skills/deep/x.ts",
    ]) {
      expect(writePolicy(bad, existing, created), bad).not.toBeNull();
    }
  });

  it("may rewrite a file it created itself in this run", () => {
    expect(writePolicy(SKILL, new Set([SKILL]), new Set([SKILL]))).toBeNull();
  });

  it("may read only inside src/core", () => {
    expect(readPolicy("src/core/types.ts")).toBeNull();
    expect(readPolicy("src/core/skills/integers-ops.ts")).toBeNull();
    for (const bad of ["src/server/store.ts", ".env.local", "src/core/../../.env.local", "data/demo.db"]) expect(readPolicy(bad), bad).not.toBeNull();
  });
});

describe("runAuthor (FAKE model)", () => {
  it("writes a skill and its test, fixes a failing test, and stops when the tests pass", async () => {
    const f = fakePorts([false, true]);
    const model = scriptedModel([
      toolCall("list_files", { dir: "src/core/skills" }),
      toolCall("read_file", { path: "src/core/skills/integers-ops.ts" }),
      toolCall("write_file", { path: SKILL, content: "export const v1 = 1;" }),
      toolCall("write_file", { path: TEST, content: "// tests" }),
      toolCall("run_tests", {}),
      toolCall("write_file", { path: SKILL, content: "export const v2 = 2;" }),
      toolCall("run_tests", {}),
      finalAnswer("never reached"),
    ]);
    const r = await runAuthor({ model, ports: f.ports, skillId: "alg.integers.multiply", description: "multiply integers" });
    expect(r).toMatchObject({ status: "tests_passed", testRuns: 2 });
    expect(r.files.sort()).toEqual([TEST, SKILL]);
    expect(f.files.get(SKILL)).toBe("export const v2 = 2;");
    expect(r.checklist.join("\n")).toMatch(/index\.ts/); // registering the skill is left for Das
    expect(r.checklist.length).toBeGreaterThanOrEqual(5);
    const seen = model.requests[2].messages.at(-1)!.content!;
    expect(seen).toContain("an example skill"); // read_file gave it the example
    expect(model.requests[5].messages.at(-1)!.content).toMatch(/expected 12 to be -12/); // it saw why the tests failed
  });

  it("refuses writes outside the allowed folders, and the file is not written", async () => {
    const f = fakePorts([]);
    const model = scriptedModel([toolCall("write_file", { path: "src/server/mastery.ts", content: "evil" }), finalAnswer("ok")]);
    await runAuthor({ model, ports: f.ports, skillId: "alg.x", description: "x" });
    expect(f.files.has("src/server/mastery.ts")).toBe(false);
    expect(model.requests[1].messages.at(-1)!.content).toMatch(/Refused/);
  });

  it("does not stop on passing tests until it has written both a skill file and a test file", async () => {
    const f = fakePorts([true, true]);
    const model = scriptedModel([
      toolCall("run_tests", {}),
      toolCall("write_file", { path: SKILL, content: "s" }),
      toolCall("write_file", { path: TEST, content: "t" }),
      toolCall("run_tests", {}),
    ]);
    const r = await runAuthor({ model, ports: f.ports, skillId: "alg.integers.multiply", description: "d" });
    expect(r).toMatchObject({ status: "tests_passed", testRuns: 2, turns: 4 });
  });

  it("stops after maxTurns (20 by default)", async () => {
    const f = fakePorts([]);
    const model = scriptedModel(Array.from({ length: 30 }, () => toolCall("list_files", { dir: "src/core/skills" })));
    const r = await runAuthor({ model, ports: f.ports, skillId: "alg.x", description: "x" });
    expect(r).toMatchObject({ status: "stopped", turns: 20 });
  });

  it("reports a failed run (for example every AI provider failed) without crashing, with the turns it did take", async () => {
    const f = fakePorts([]);
    let calls = 0;
    const model = (async () => {
      if (calls++ < 2) return { message: toolCall("list_files", { dir: "src/core/skills" }), provider: "fake", model: "fake" };
      throw new Error("All AI providers failed: groq: HTTP 429");
    }) as Parameters<typeof runAuthor>[0]["model"];
    const r = await runAuthor({ model, ports: f.ports, skillId: "alg.x", description: "x" });
    expect(r).toMatchObject({ status: "failed", turns: 2, error: expect.stringMatching(/429/) });
  });
});
