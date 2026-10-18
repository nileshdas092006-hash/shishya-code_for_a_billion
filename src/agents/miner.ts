import { formatEquation, fracText } from "../core/format";
import { validateMinedMistake, type MinedMistakeSpec, type UnknownError, type ValidationResult } from "../core/minedMistake";
import { getSkillEntry } from "../core/skills";
import type { Mistake, SkillSpec } from "../core/types";
import type { ChatModel } from "./llm";
import { runAgent, type AgentTool } from "./loop";

// The Misconception Miner: reads anonymous wrong answers that no known mistake explains, proposes ONE new mistake
// as DATA (never code), checks it with our validator, and saves it as a DRAFT_TESTED draft for a teacher to
// approve. It cannot touch mastery or any child's record: its only way to write is submit_draft, and that only
// accepts JSON that has just passed validation.

/** What the Miner may use. The caller (src/server/miner-ports.ts) decides how; the Miner never sees the database. */
export type MinerPorts = {
  /** Anonymous: the question's a, b, c, d, the wrong answer, and how often it was given. */
  getUnknownErrors(skillId: string): Promise<UnknownError[]>;
  /** Every mistake already known for the skill (authored, approved and drafted). */
  existingMistakes(skillId: string): Promise<Mistake[]>;
  saveDraft(skillId: string, spec: MinedMistakeSpec, report: ValidationResult): Promise<string>;
};

export type MinerResult = {
  status: "not_enough_data" | "draft_saved" | "no_draft";
  unknownErrors: number;
  validations: number;
  turns: number;
  draftId?: string;
  agentStatus?: string;
  finalText?: string;
};

const MIN_UNKNOWN = 3;

function systemPrompt(skill: SkillSpec): string {
  return `You are the Misconception Miner for Shishya, a maths practice app for Indian school children (NCERT).
Skill: ${skill.id}, equations a·x + b = c·x + d. The correct working has 5 lines, for example 4x − 3 = 2x + 7:
L1 4x − 3 = 2x + 7 | L2 4x − 2x − 3 = 7 | L3 4x − 2x = 7 + 3 | L4 2x = 10 | L5 x = 5

Children gave wrong answers that no known mistake explains. Find ONE common misconception that explains at least 3
of them, and describe it as JSON DATA (never code):
{ "id": "kebab-case-id", "label": "for the teacher", "childLabel": "for the child, NCERT language",
  "stepType": "move-x" | "move-const" | "simplify" | "divide", "firstWrongLine": 2..5,
  "lines": { "<n>": "<template>" for every n from firstWrongLine to 5 }, "answerFormula": "<formula>" }
Formulas use ONLY a, b, c, d, whole numbers, + - * / and brackets. Templates are the Shishya's wrong lines: x,
whole numbers, + - = and {formulas}, e.g. "{a - c}x = {d + b}". Lines before firstWrongLine are copied from the
correct working. The last line must be "x = {<answerFormula>}". childLabel must say what to do using the NCERT
words "do the same operation on both sides"; never say "move" or "change the sign".
Known mistakes, as examples of the format:
{"id":"forgot-to-divide","firstWrongLine":5,"lines":{"5":"x = {d - b}"},"answerFormula":"d - b"}
{"id":"kept-const-sign","firstWrongLine":3,"lines":{"3":"{a}x - {c}x = {d} + {b}","4":"{a - c}x = {d + b}","5":"x = {(d + b) / (a - c)}"},"answerFormula":"(d + b) / (a - c)"}
Steps: call get_unknown_errors; propose; call validate_mined_mistake; fix it if it fails; when it passes, call
submit_draft with exactly the same JSON. A teacher will review it. If nothing fits, stop and say so.`;
}

const describeError = (skill: SkillSpec, e: UnknownError) => {
  const { a, b, c, d } = e.params;
  const correct = fracText(skill.solve({ skillId: skill.id, version: skill.version, seed: 0, params: e.params, text: "", answer: { num: 0, den: 1 } }).answer);
  return { a, b, c, d, question: formatEquation([[a, true], [b, false]], [[c, true], [d, false]]), correctAnswer: correct, wrongAnswer: e.wrongAnswer, count: e.count ?? 1 };
};

const mistakeParam = {
  type: "object",
  properties: { mistake: { type: "object", description: "The mined mistake JSON." } },
  required: ["mistake"],
};

export async function runMiner(opts: {
  model: ChatModel;
  ports: MinerPorts;
  skillId: string;
  maxTurns?: number;
  maxValidations?: number;
}): Promise<MinerResult> {
  const entry = getSkillEntry(opts.skillId);
  if (!entry) throw new Error(`Unknown skill: ${opts.skillId}`);
  const skill = entry.spec;
  const maxValidations = opts.maxValidations ?? 5;

  const unknownErrors = await opts.ports.getUnknownErrors(skill.id);
  const total = unknownErrors.reduce((n, e) => n + (e.count ?? 1), 0);
  if (total < MIN_UNKNOWN) return { status: "not_enough_data", unknownErrors: unknownErrors.length, validations: 0, turns: 0 };
  const existing = await opts.ports.existingMistakes(skill.id);

  let validations = 0;
  let lastPassing: string | null = null;
  let draftId: string | undefined;
  const asSpec = (args: unknown) => {
    const a = args as { mistake?: unknown };
    return (a && typeof a === "object" && "mistake" in a ? a.mistake : args) as MinedMistakeSpec;
  };
  const check = (spec: unknown) => validateMinedMistake(spec, { skill, unknownErrors, existing });

  const tools: AgentTool[] = [
    {
      def: {
        type: "function",
        function: {
          name: "get_unknown_errors",
          description: "Read the anonymous wrong answers no known mistake explains (question numbers, wrong answer, count).",
          parameters: { type: "object", properties: {} },
        },
      },
      run: () => ({ content: JSON.stringify(unknownErrors.map((e) => describeError(skill, e))) }),
    },
    {
      def: {
        type: "function",
        function: {
          name: "validate_mined_mistake",
          description: `Check a proposed mined mistake against the data and 1,000 generated questions. At most ${maxValidations} tries.`,
          parameters: mistakeParam,
        },
      },
      run: (args) => {
        const spec = asSpec(args);
        validations++;
        const report = check(spec);
        lastPassing = report.ok ? JSON.stringify(spec) : lastPassing;
        const content = JSON.stringify({ ok: report.ok, errors: report.errors, reproduced: report.reproduced });
        if (!report.ok && validations >= maxValidations) {
          return { content: `${content}\nNo validation tries left. Stop.`, endsRun: true };
        }
        return { content };
      },
    },
    {
      def: {
        type: "function",
        function: {
          name: "submit_draft",
          description: "Save a mined mistake that has just passed validate_mined_mistake, as a draft for a teacher to review.",
          parameters: mistakeParam,
        },
      },
      run: async (args) => {
        const spec = asSpec(args);
        if (JSON.stringify(spec) !== lastPassing) {
          return { content: "Refused: validate this exact JSON with validate_mined_mistake first, then submit it unchanged." };
        }
        const report = check(spec); // check again: never trust the conversation
        if (!report.ok) return { content: `Refused: ${report.errors.join("; ")}` };
        draftId = await opts.ports.saveDraft(skill.id, spec, report);
        return { content: `Saved draft ${draftId} for a teacher to review.`, endsRun: true };
      },
    },
  ];

  const result = await runAgent({
    model: opts.model,
    system: systemPrompt(skill),
    user: `Find a new misconception for ${skill.id}. ${unknownErrors.length} kinds of unknown wrong answers are logged. Start with get_unknown_errors.`,
    tools,
    maxTurns: opts.maxTurns ?? 12,
  });
  return {
    status: draftId ? "draft_saved" : "no_draft",
    unknownErrors: unknownErrors.length,
    validations,
    turns: result.turns,
    draftId,
    agentStatus: result.status,
    finalText: result.final,
  };
}
