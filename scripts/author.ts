// npm run author -- <skillId> "<description>"            e.g. npm run author -- alg.integers.multiply "multiply integers"
// npm run author -- <skillId> "<description>" --fake     an offline check of the worktree + tests (no AI, no key)
//
// The Skill Author agent drafts a new skill + tests in a SEPARATE git worktree on a new branch author/<skillId>.
// Your working folder is never touched. Its files are committed on that branch; it is NEVER merged. Review it with
// the printed checklist. Keys come from .env.local and are never printed; model names may come from .env.example.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runAuthor, type AuthorPorts } from "../src/agents/author";
import { finalAnswer, scriptedModel, toolCall } from "../src/agents/fake-model";
import { createLlmClient, providersFromEnv } from "../src/agents/llm";
import { loadEnv } from "./load-env";

loadEnv();
const args = process.argv.slice(2).filter((a) => a !== "--fake");
const fake = process.argv.includes("--fake");
const [skillId, description] = args;
if (!skillId || !/^alg\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(skillId) || !description?.trim()) {
  console.log('Usage: npm run author -- alg.<name> "<what the skill is>" [--fake]');
  process.exit(1);
}
if (!fake && providersFromEnv().length === 0) {
  console.log("No usable AI provider: put GROQ_API_KEY or OPENROUTER_API_KEY in .env.local (model names can come from .env.example).");
  process.exit(0);
}

const git = (cwd: string, ...a: string[]) => {
  const r = spawnSync("git", a, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")} failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
};
const repo = git(process.cwd(), "rev-parse", "--show-toplevel");
const branch = `author/${skillId}`;
if (spawnSync("git", ["rev-parse", "--verify", "--quiet", branch], { cwd: repo }).status === 0) {
  console.log(`Branch ${branch} already exists. Review or delete it first (git branch -D ${branch}).`);
  process.exit(1);
}

const slug = skillId.replace(/^alg\./, "").replace(/\./g, "-");
const worktree = join(tmpdir(), `shishya-author-${slug}-${Date.now()}`);
git(repo, "worktree", "add", "-b", branch, worktree, "HEAD");
const modules = join(worktree, "node_modules");
symlinkSync(join(repo, "node_modules"), modules, "junction"); // tests need the packages; nothing is copied

const ports: AuthorPorts = {
  listFiles: async (dir) => readdirSync(join(worktree, dir)).filter((f) => statSync(join(worktree, dir, f)).isFile()).map((f) => `${dir}/${f}`),
  readFile: async (path) => readFileSync(join(worktree, path), "utf8"),
  writeFile: async (path, content) => {
    mkdirSync(dirname(join(worktree, path)), { recursive: true });
    writeFileSync(join(worktree, path), content);
  },
  exists: async (path) => existsSync(join(worktree, path)),
  runTests: async () => {
    const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["test"], {
      cwd: worktree,
      encoding: "utf8",
      timeout: 300_000,
      shell: process.platform === "win32",
    });
    const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.replace(/\x1b\[[0-9;]*m/g, "");
    return { passed: r.status === 0, output };
  },
};

/** --fake: copy a finished skill under the new name, so the worktree, tests and commit can be checked offline. */
function fakeModel() {
  const source = readFileSync(join(repo, "src/core/skills/integers-ops.ts"), "utf8")
    .replace(`const SKILL_ID = "alg.integers.ops";`, `const SKILL_ID = "${skillId}";`)
    .replace(/integersOps/g, "draftSkill");
  const test = `import { describe, expect, it } from "vitest";
import { draftSkill, draftSkillApply } from "../skills/${slug}";
import { describeSkillProperties } from "./skill-properties";

describe("${skillId}", () => {
  it("has the right id", () => expect(draftSkill.id).toBe("${skillId}"));
});
describeSkillProperties({ spec: draftSkill, generateApply: draftSkillApply });
`;
  return scriptedModel([
    toolCall("write_file", { path: `src/core/skills/${slug}.ts`, content: source }),
    toolCall("write_file", { path: `src/core/__tests__/${slug}.test.ts`, content: test }),
    toolCall("run_tests", {}),
    finalAnswer("done"),
  ]);
}

let exitCode = 0;
try {
  const providers = providersFromEnv().map((p) => `${p.name} (${p.model})`).join(", ");
  console.log(`Skill Author: ${skillId} — "${description}"\n  branch ${branch}, ${fake ? "FAKE model" : `AI providers: ${providers}`}`);
  const result = await runAuthor({ model: fake ? fakeModel() : createLlmClient(), ports, skillId, description });
  if (result.files.length) {
    git(worktree, "add", "--", ...result.files);
    git(
      worktree,
      "-c", "user.name=Shishya Skill Author (AI draft)",
      "-c", "user.email=skill-author@shishya.invalid",
      "commit", "-q", "-m", `Skill Author draft: ${skillId} (${result.status}, NOT reviewed)`,
    );
  }
  console.log(`  result: ${result.status} after ${result.turns} turns and ${result.testRuns} test runs${result.error ? ` (${result.error})` : ""}`);
  console.log(`  files: ${result.files.join(", ") || "none"}`);
  if (result.finalText) console.log(`  the model said: ${result.finalText.slice(0, 300)}`);
  if (result.lastTestOutput) console.log(`  last test output (end):\n${result.lastTestOutput.split("\n").slice(-12).map((l) => `    ${l}`).join("\n")}`);
  console.log("\nReview checklist:");
  for (const item of result.checklist) console.log(`  [ ] ${item}`);
  if (!result.files.length) console.log(`\nNo files were written; branch ${branch} is empty (delete it with git branch -D ${branch}).`);
} catch (e) {
  console.error(`Skill Author failed: ${e instanceof Error ? e.message : "unknown error"}`);
  exitCode = 1;
} finally {
  // Remove the link to node_modules FIRST (only the link, never the packages), then the worktree. The branch stays.
  try {
    unlinkSync(modules);
  } catch {
    rmdirSync(modules);
  }
  if (!existsSync(join(repo, "node_modules", "next", "package.json"))) throw new Error("node_modules check failed: stop and look");
  git(repo, "worktree", "remove", "--force", worktree);
  console.log(`\nThe draft is on branch ${branch} (not merged). Look at it with: git log ${branch} --stat`);
}
process.exitCode = exitCode;
