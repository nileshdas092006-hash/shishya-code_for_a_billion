import type { ChatModel } from "./llm";
import { runAgent, type AgentTool } from "./loop";

// The Skill Author: an AI agent that DRAFTS a new skill (a skill file + its tests) for Das to review.
// Its powers are deliberately small:
//   - it may read files inside src/core only;
//   - it may only CREATE new files in src/core/skills/*.ts and src/core/__tests__/*.test.ts (and rewrite its own);
//     it cannot change any existing file, so it cannot register the skill, touch the server, the app or mastery;
//   - it may only run `npm test`;
//   - it stops when the tests pass (having written both files), when it says it is finished, or after 20 turns.
// The command-line wrapper (scripts/author.ts) runs it in a separate git worktree on branch author/<skillId>,
// commits its files there, and never merges. A person reviews the branch with the checklist below.

export type AuthorPorts = {
  listFiles(dir: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  runTests(): Promise<{ passed: boolean; output: string }>;
};

export type AuthorResult = {
  status: "tests_passed" | "stopped" | "failed";
  turns: number;
  testRuns: number;
  files: string[];
  lastTestOutput: string;
  finalText?: string;
  error?: string;
  checklist: string[];
};

const SKILL_FILE = /^src\/core\/skills\/[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/;
const TEST_FILE = /^src\/core\/__tests__\/[a-z0-9]+(?:-[a-z0-9]+)*\.test\.ts$/;
const READABLE = /^src\/core\/[A-Za-z0-9_\-./]+\.ts$/;
const MAX_FILE_CHARS = 60_000;
const MAX_READ_CHARS = 15_000;
const LISTABLE = ["src/core/skills", "src/core/__tests__", "src/core"];

/** null if the Author may write this file, else the reason it may not. */
export function writePolicy(path: string, existing: Set<string>, created: Set<string>): string | null {
  if (typeof path !== "string" || path.includes("\\") || path.includes("..") || path.startsWith("/") || /^[a-z]:/i.test(path)) {
    return "use a plain relative path with forward slashes, like src/core/skills/my-skill.ts";
  }
  if (!SKILL_FILE.test(path) && !TEST_FILE.test(path)) {
    return "you may only write src/core/skills/<name>.ts or src/core/__tests__/<name>.test.ts (lower-case words joined by -)";
  }
  if (existing.has(path) && !created.has(path)) return "you may not change an existing file; create a new one";
  return null;
}

/** null if the Author may read this file, else the reason it may not. */
export function readPolicy(path: string): string | null {
  if (typeof path !== "string" || path.includes("..") || path.includes("\\") || !READABLE.test(path)) {
    return "you may only read .ts files inside src/core";
  }
  return null;
}

export const REVIEW_CHECKLIST = (skillId: string, files: string[]) => [
  `Branch author/${skillId} holds the draft (${files.join(", ") || "no files"}). It was NOT merged.`,
  "Read every mistake function: is it a real misconception from the NCERT chapter, and is its answer right on the worked examples?",
  "Read every child message: it must say what went wrong and the correct step in NCERT words, and never tell the child to do the mistaken step. The AI can be wrong about advice.",
  "Check the generator ranges by hand (sizes of numbers, never 0 where it matters) and that no hint gives away an answer.",
  "Run npm run lint on the branch: src/core must stay pure (no Math.random, no imports from outside src/core).",
  `Register the skill in src/core/skills/index.ts and set its prerequisites (the agent is not allowed to edit that file).`,
  "Add its title, example, task and answer label to src/i18n/en.ts, and translate every new string into src/i18n/hi.ts.",
  `Write docs/skills/${skillId}.md, then run npm test and npm run build before merging.`,
];

function systemPrompt(skillId: string, description: string): string {
  const slug = skillId.replace(/^alg\./, "").replace(/\./g, "-");
  return `You are the Skill Author for Shishya, a maths practice app for Indian school children (NCERT textbooks).
Draft ONE new skill: id "${skillId}", described as: ${description}

Write exactly two files:
  src/core/skills/${slug}.ts           the skill
  src/core/__tests__/${slug}.test.ts   its tests
You may read files in src/core, create these two files (and rewrite them), and run the tests. You cannot change any
other file, so do NOT try to edit src/core/skills/index.ts: Das registers the skill after review.

Start by reading src/core/types.ts, src/core/skills/helpers.ts and one finished skill as a model, for example
src/core/skills/integers-ops.ts (numbers) or src/core/skills/linear-two-step.ts (equations), and the shared test
helper src/core/__tests__/skill-properties.ts.

The skill file exports a SkillSpec (id "${skillId}", version "1.0.0", statement, prerequisites, answerKind,
generate(rng), solve(instance), checkLine(instance, line, typed), mistakes (3 Mistake objects with id, label,
childLabel, stepType, origin "authored", optional appliesTo, apply), hintLadder (4 hints), teachRule and proofRule as
in the other skills) and a word-problem generator (rng) => ApplyItem with an Indian everyday story in English
(text) and Hindi (textHi). Rules: pure TypeScript; import only from src/core; randomness ONLY from the rng passed in
(never Math.random); exact fractions from src/core/fraction.ts; reuse helpers.ts (nonZero, num, toTrace,
mistakesAreSound) and lineCheck.ts (checkArithLine, checkExpressionLine, checkEquationLine). Every mistake
must never give the correct answer and the mistakes' answers must differ: make generate() reject questions where
they do not (mistakesAreSound does this). Child messages use NCERT words ("do the same operation on both sides"),
say what went wrong and the correct step, never tell the child to do the mistake, never say "move" or "change the
sign". Hints never contain an answer (use other numbers, or y instead of x, in the worked example).

The test file imports the skill and word-problem generator directly and must:
  - check two or three worked examples exactly (question text, the working line by line, the answer, each mistake);
  - call describeSkillProperties({ spec: <your skill>, generateApply: <your word problem> }) from ./skill-properties.
Then call run_tests. Fix your files until all tests pass, then stop. Keep files short and clear.`;
}

export async function runAuthor(opts: {
  model: ChatModel;
  ports: AuthorPorts;
  skillId: string;
  description: string;
  maxTurns?: number;
}): Promise<AuthorResult> {
  const { ports } = opts;
  const created = new Set<string>();
  let testRuns = 0;
  let passed = false;
  let lastTestOutput = "";
  const hasBoth = () => [...created].some((f) => SKILL_FILE.test(f)) && [...created].some((f) => TEST_FILE.test(f));
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  const tools: AgentTool[] = [
    {
      def: {
        type: "function",
        function: {
          name: "list_files",
          description: "List the files in src/core, src/core/skills or src/core/__tests__.",
          parameters: { type: "object", properties: { dir: { type: "string", enum: LISTABLE } }, required: ["dir"] },
        },
      },
      run: async (args) => {
        const dir = str((args as { dir?: unknown }).dir);
        if (!LISTABLE.includes(dir)) return { content: `Refused: you may list only ${LISTABLE.join(", ")}.` };
        return { content: (await ports.listFiles(dir)).join("\n") || "(empty)" };
      },
    },
    {
      def: {
        type: "function",
        function: {
          name: "read_file",
          description: "Read a .ts file inside src/core (long files are cut short).",
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        },
      },
      run: async (args) => {
        const path = str((args as { path?: unknown }).path);
        const why = readPolicy(path);
        if (why) return { content: `Refused: ${why}.` };
        const text = await ports.readFile(path);
        return { content: text.length > MAX_READ_CHARS ? `${text.slice(0, MAX_READ_CHARS)}\n… (cut short)` : text };
      },
    },
    {
      def: {
        type: "function",
        function: {
          name: "write_file",
          description: "Create (or rewrite your own) src/core/skills/<name>.ts or src/core/__tests__/<name>.test.ts.",
          parameters: {
            type: "object",
            properties: { path: { type: "string" }, content: { type: "string" } },
            required: ["path", "content"],
          },
        },
      },
      run: async (args) => {
        const a = args as { path?: unknown; content?: unknown };
        const path = str(a.path);
        const content = str(a.content);
        const existed = !created.has(path) && (await ports.exists(path).catch(() => false));
        const why = writePolicy(path, existed ? new Set([path]) : new Set(), created);
        if (why) return { content: `Refused: ${why}.` };
        if (!content.trim() || content.length > MAX_FILE_CHARS) return { content: `Refused: the content must be 1–${MAX_FILE_CHARS} characters.` };
        await ports.writeFile(path, content);
        created.add(path);
        return { content: `Wrote ${path} (${content.length} characters).` };
      },
    },
    {
      def: {
        type: "function",
        function: {
          name: "run_tests",
          description: "Run npm test (the whole test suite) and see the result.",
          parameters: { type: "object", properties: {} },
        },
      },
      run: async () => {
        testRuns++;
        const r = await ports.runTests();
        lastTestOutput = r.output.split("\n").slice(-80).join("\n").slice(-6000);
        if (r.passed && hasBoth()) {
          passed = true;
          return { content: "All tests passed. Your draft is done.", endsRun: true };
        }
        if (r.passed) return { content: "The tests pass, but you have not written both a skill file and a test file yet." };
        return { content: `Some tests failed:\n${lastTestOutput}` };
      },
    },
    {
      def: {
        type: "function",
        function: {
          name: "finish",
          description: "Stop now, with a short note (use it if you cannot make the tests pass).",
          parameters: { type: "object", properties: { note: { type: "string" } }, required: ["note"] },
        },
      },
      run: (args) => ({ content: `Stopped: ${str((args as { note?: unknown }).note)}`, endsRun: true }),
    },
  ];

  const base = () => ({ testRuns, files: [...created], lastTestOutput, checklist: REVIEW_CHECKLIST(opts.skillId, [...created]) });
  let modelReplies = 0; // so a failed run still reports how many turns it took
  const model: ChatModel = async (request) => {
    const reply = await opts.model(request);
    modelReplies++;
    return reply;
  };
  try {
    const result = await runAgent({
      model,
      system: systemPrompt(opts.skillId, opts.description),
      user: `Draft the skill ${opts.skillId}: ${opts.description}. Start by reading the files you need.`,
      tools,
      maxTurns: opts.maxTurns ?? 20,
    });
    return { status: passed ? "tests_passed" : "stopped", turns: result.turns, finalText: result.final, ...base() };
  } catch (e) {
    return { status: "failed", turns: modelReplies, error: e instanceof Error ? e.message : "the AI failed", ...base() };
  }
}
