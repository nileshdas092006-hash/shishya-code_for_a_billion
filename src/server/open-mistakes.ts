import { answerText } from "../core/answer";
import { toMistake, type MinedMistakeSpec } from "../core/minedMistake";
import { mistakeExample } from "../core/example";
import type { Mistake, SkillSpec } from "../core/types";
import type { Services } from "./services";
import { logServerError } from "./setup";
import type { Registry } from "./skills";
import type { MinedMistakeRow } from "./store";

// GET /api/mistakes: Shishya's mistake library as open data, so other tutors can use it. For every skill: its
// authored mistakes and the teacher-APPROVED mined ones, as specs, with a worked example made by src/core.
// Built ONLY from the skill code and the approved rows' mistake specs: never child codes, answers, counts, drafts,
// rejected rows, who approved a row (it names a class), or the AI's suggested child text.

export const MISTAKES_LICENCE = "MIT";
export const SKILL_SPEC_URL = "https://github.com/nileshdas092006-hash/shishya-code_for_a_billion/blob/main/docs/SKILL_SPEC.md";
const EXAMPLE_SEEDS = 500;

type Example = { question: string; working: string[]; result: string };
export type OpenMistake = {
  id: string;
  label: string;
  stepType: string;
  origin: "authored" | "mined";
  /** The working line where the mistake first goes wrong (L1 is the question): the spec's for a mined one, the example's for an authored one. */
  firstWrongLine: number;
  /** Mined only: the wrong lines as templates, and the formula of the wrong answer (docs/SKILL_SPEC.md). */
  lines?: Record<string, string>;
  answerFormula?: string;
  example: Example | null;
};
export type OpenMistakes = {
  licence: string;
  spec: string;
  about: string;
  skills: { skillId: string; version: string; statement: string; answerKind: string; mistakes: OpenMistake[] }[];
};

/** The first question (seeds 1, 2, …) this mistake makes sense for, worked through with it. Deterministic. */
function exampleOf(skill: SkillSpec, m: Mistake): { example: Example; firstWrongLine: number } | null {
  const ex = mistakeExample(skill, m, 1, EXAMPLE_SEEDS);
  if (!ex) return null;
  return { example: { question: ex.instance.text, working: ex.trace.map((l) => l.text), result: answerText(ex.answer) }, firstWrongLine: ex.firstWrongLine };
}

/** The approved row's mistake spec, if it is complete and still loads (src/core checks its formula and templates). */
function approvedSpec(row: MinedMistakeRow, skill: SkillSpec): { spec: MinedMistakeSpec; mistake: Mistake } | null {
  if (row.status !== "APPROVED") return null;
  try {
    const spec = JSON.parse(row.source) as MinedMistakeSpec;
    const ok =
      typeof spec.id === "string" && typeof spec.label === "string" && typeof spec.stepType === "string" &&
      Number.isInteger(spec.firstWrongLine) && typeof spec.answerFormula === "string" && spec.lines !== null && typeof spec.lines === "object" &&
      Object.entries(spec.lines).every(([k, v]) => /^\d+$/.test(k) && typeof v === "string");
    return ok ? { spec, mistake: toMistake(spec, skill) } : null;
  } catch {
    return null;
  }
}

/** Pure: the open library from the skill code and the stored mined rows (only APPROVED ones are used). */
export function buildOpenMistakes(registry: Registry, minedRows: MinedMistakeRow[]): OpenMistakes {
  return {
    licence: MISTAKES_LICENCE,
    spec: SKILL_SPEC_URL,
    about: "Shishya's algebra mistakes: authored ones and ones found in real classes and approved by a teacher. No child data.",
    skills: Object.values(registry).map(({ spec: skill }) => {
      const authored = skill.mistakes.map((m): OpenMistake => {
        const ex = exampleOf(skill, m);
        return { id: m.id, label: m.label, stepType: m.stepType, origin: "authored", firstWrongLine: ex?.firstWrongLine ?? 0, example: ex?.example ?? null };
      });
      const mined = minedRows
        .filter((r) => r.skillId === skill.id)
        .map((r) => approvedSpec(r, skill))
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .map(({ spec, mistake }): OpenMistake => ({
          id: spec.id,
          label: spec.label,
          stepType: spec.stepType,
          origin: "mined",
          firstWrongLine: spec.firstWrongLine,
          lines: { ...spec.lines },
          answerFormula: spec.answerFormula,
          example: exampleOf(skill, mistake)?.example ?? null,
        }));
      return { skillId: skill.id, version: skill.version, statement: skill.statement, answerKind: skill.answerKind, mistakes: [...authored, ...mined] };
    }),
  };
}

/** The route's answer: the library, cached publicly for 5 minutes; 503 { ok: false } (cause in the server log) if it cannot be read. */
export async function mistakesResponse(getServices: () => Promise<Services>): Promise<Response> {
  try {
    const body = await (await getServices()).openMistakes();
    return Response.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (e) {
    logServerError("open mistakes", e);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
