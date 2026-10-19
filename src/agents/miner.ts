import { asFraction } from "../core/answer";
import { formatEquation, fracText } from "../core/format";
import { validateMinedMistake, type MinedMistakeSpec, type UnknownError, type ValidationResult } from "../core/minedMistake";
import { createRng } from "../core/rng";
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
  status: "not_enough_data" | "draft_saved" | "no_draft" | "failed";
  /** Why the run failed (for example every AI provider failed). */
  error?: string;
  unknownErrors: number;
  validations: number;
  turns: number;
  draftId?: string;
  /** Every proposal it validated: the formula, whether it passed, and why not. */
  attempts: { id: string; answerFormula: string; ok: boolean; reproduced: number; errors: string[] }[];
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
correct working. The last line must be "x = {<answerFormula>}".
label (for the teacher) must NAME the mistake, e.g. "Divides by the x-coefficient from the question, not the collected one".
childLabel (for the child, one or two short sentences) must say WHAT WENT WRONG and WHAT THE CORRECT STEP IS, in
NCERT words such as "do the same operation on both sides". It must NEVER tell the child to do the mistaken step.
Good: "You divided by the number in front of x in the question. First collect the x-terms, then divide both sides by
the number in front of x in that line." Bad: "Divide by the coefficient of x in the original equation." (that is the
mistake). Never say "move" or "change the sign".
Known mistakes, as examples of the format:
{"id":"forgot-to-divide","firstWrongLine":5,"lines":{"5":"x = {d - b}"},"answerFormula":"d - b"}
{"id":"kept-const-sign","firstWrongLine":3,"lines":{"3":"{a}x - {c}x = {d} + {b}","4":"{a - c}x = {d + b}","5":"x = {(d + b) / (a - c)}"},"answerFormula":"(d + b) / (a - c)"}
Steps: call get_unknown_errors; propose; call validate_mined_mistake; fix it if it fails; when it passes, call
submit_draft with exactly the same JSON. A teacher will review it. If nothing fits, stop and say so.`;
}

const describeError = (skill: SkillSpec, e: UnknownError) => {
  const { a, b, c, d } = e.params;
  const correct = fracText(asFraction(skill.solve({ skillId: skill.id, version: skill.version, seed: 0, params: e.params, text: "", answer: { num: 0, den: 1 } }).answer));
  return { a, b, c, d, question: formatEquation([[a, true], [b, false]], [[c, true], [d, false]]), correctAnswer: correct, wrongAnswer: e.wrongAnswer, count: e.count ?? 1 };
};

/** Every field, described, so models write valid tool-call JSON. */
const mistakeSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "kebab-case name, e.g. divided-by-a" },
    label: { type: "string", description: "what went wrong, for the teacher" },
    childLabel: { type: "string", description: "what to do, for the child, in NCERT words" },
    stepType: { type: "string", enum: ["move-x", "move-const", "simplify", "divide"] },
    firstWrongLine: { type: "integer", minimum: 2, maximum: 5 },
    lines: {
      type: "object",
      description: 'the wrong line templates from firstWrongLine to 5, e.g. {"5": "x = {(d - b) / a}"}',
      additionalProperties: { type: "string" },
    },
    answerFormula: { type: "string", description: "the wrong answer as a formula of a, b, c, d, e.g. (d - b) / a" },
  },
  required: ["id", "label", "childLabel", "stepType", "firstWrongLine", "lines", "answerFormula"],
};

/** The same JSON with keys in a fixed order, so the same mistake always compares equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

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
  // Mined mistakes are formulas over a, b, c, d for a·x + b = c·x + d with a number answer.
  if (skill.answerKind !== "number" || !["a", "b", "c", "d"].every((k) => k in skill.generate(createRng(1)).params)) {
    throw new Error(`The Misconception Miner only supports equations a·x + b = c·x + d for now (${opts.skillId} is a different kind of skill).`);
  }
  const maxValidations = opts.maxValidations ?? 5;

  const unknownErrors = await opts.ports.getUnknownErrors(skill.id);
  const total = unknownErrors.reduce((n, e) => n + (e.count ?? 1), 0);
  if (total < MIN_UNKNOWN) {
    return { status: "not_enough_data", unknownErrors: unknownErrors.length, validations: 0, turns: 0, attempts: [] };
  }
  const existing = await opts.ports.existingMistakes(skill.id);

  let validations = 0;
  const attempts: MinerResult["attempts"] = [];
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
          parameters: mistakeSchema,
        },
      },
      run: (args) => {
        const spec = asSpec(args);
        validations++;
        const report = check(spec);
        attempts.push({
          id: String(spec?.id ?? ""),
          answerFormula: String(spec?.answerFormula ?? ""),
          ok: report.ok,
          reproduced: report.reproduced,
          errors: report.errors,
        });
        lastPassing = report.ok ? canonical(spec) : lastPassing;
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
          parameters: mistakeSchema,
        },
      },
      run: async (args) => {
        const spec = asSpec(args);
        if (canonical(spec) !== lastPassing) {
          return { content: "Refused: validate this exact JSON with validate_mined_mistake first, then submit it unchanged." };
        }
        const report = check(spec); // check again: never trust the conversation
        if (!report.ok) return { content: `Refused: ${report.errors.join("; ")}` };
        draftId = await opts.ports.saveDraft(skill.id, spec, report);
        return { content: `Saved draft ${draftId} for a teacher to review.`, endsRun: true };
      },
    },
  ];

  let result;
  try {
    result = await runAgent({
      model: opts.model,
      system: systemPrompt(skill),
      user: `Find a new misconception for ${skill.id}. ${unknownErrors.length} kinds of unknown wrong answers are logged. Start with get_unknown_errors.`,
      tools,
      maxTurns: opts.maxTurns ?? 12,
    });
  } catch (e) {
    // the AI failed part-way (for example every provider failed): report it, keep what was already checked
    return {
      status: draftId ? "draft_saved" : "failed",
      error: e instanceof Error ? e.message : "the AI failed",
      unknownErrors: unknownErrors.length,
      validations,
      turns: 0,
      draftId,
      attempts,
    };
  }
  return {
    status: draftId ? "draft_saved" : "no_draft",
    unknownErrors: unknownErrors.length,
    validations,
    turns: result.turns,
    draftId,
    attempts,
    agentStatus: result.status,
    finalText: result.final,
  };
}
