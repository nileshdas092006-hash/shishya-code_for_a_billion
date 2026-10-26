import { mistakeExample, type MistakeExample } from "@/core/example";
import { toMistake, type MinedMistakeSpec } from "@/core/minedMistake";
import { getSkillEntry } from "@/core/skills";
import { Equation } from "../../_components/Equation";

// The worked example of a mistake on the class board (stuck board groups and Miner drafts): a question the mistake
// APPLIES to, from a fixed seed so the board looks the same every time, worked through by src/core with that
// mistake (so its last line is the mistake's own answer).

const EXAMPLE_SEED = 20261018;

/** An authored mistake's example on the stuck board; null for an unknown skill or mistake (e.g. the "unknown" group). */
export function boardExample(skillId: string, mistakeId: string): MistakeExample | null {
  const spec = getSkillEntry(skillId)?.spec;
  const mistake = spec?.mistakes.find((m) => m.id === mistakeId);
  return spec && mistake ? mistakeExample(spec, mistake, EXAMPLE_SEED) : null;
}

/** A mined draft's example on its review card; null if its spec no longer loads. */
export function minedExample(skillId: string, spec: MinedMistakeSpec): MistakeExample | null {
  const skill = getSkillEntry(skillId)?.spec;
  if (!skill) return null;
  try {
    return mistakeExample(skill, toMistake(spec, skill), EXAMPLE_SEED);
  } catch {
    return null; // a formula or template that no longer parses
  }
}

export function MistakeExampleLines({ example }: { example: MistakeExample }) {
  return (
    <ol className="flex flex-col gap-1">
      {example.trace.map((line, i) => (
        <li key={i} className={`flex items-baseline gap-3 ${i + 1 === example.firstWrongLine ? "text-red-800" : ""}`}>
          <span className="shrink-0 font-semibold">L{i + 1}</span>
          <span className="flex-1 min-w-0">
            <Equation text={line.text} size="sm" />
            {i + 1 === example.firstWrongLine && <span className="block text-base font-bold">← first wrong line</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
