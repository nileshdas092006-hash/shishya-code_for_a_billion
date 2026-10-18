import { randomUUID } from "node:crypto";
import { toMistake, type MinedMistakeSpec, type UnknownError } from "../core/minedMistake";
import { getSkillEntry } from "../core/skills";
import type { Mistake, SkillSpec } from "../core/types";
import type { MinerPorts } from "../agents/miner";
import type { MinedMistakeRow, MinedStatus, Store } from "./store";

// The ONLY bridge between the Misconception Miner and the database. It hands the Miner anonymous numbers
// (a, b, c, d, the wrong answer, a count) and lets it save a tested draft. Nothing else: no students, no codes,
// no typed lines, no mastery.

/** Turns stored mined mistakes (JSON data) into Mistakes; a row that does not load is skipped. */
export function mistakesFromRows(rows: MinedMistakeRow[], skill: SkillSpec): Mistake[] {
  const out: Mistake[] = [];
  for (const row of rows) {
    try {
      out.push(toMistake(JSON.parse(row.source) as MinedMistakeSpec, skill));
    } catch {
      // a damaged row is never used
    }
  }
  return out;
}

export async function minedMistakes(store: Store, skill: SkillSpec, statuses: MinedStatus[]): Promise<Mistake[]> {
  const rows: MinedMistakeRow[] = [];
  for (const status of statuses) rows.push(...(await store.listMinedMistakes(status, skill.id)));
  return mistakesFromRows(rows, skill);
}

/** The anonymous unknown wrong answers for a skill: only the question's numbers and the answer. */
export async function unknownErrors(store: Store, skillId: string): Promise<UnknownError[]> {
  return (await store.listUnknownErrors(skillId)).map((r) => {
    const p = JSON.parse(r.paramsJson) as Record<string, unknown>;
    return { params: { a: Number(p.a), b: Number(p.b), c: Number(p.c), d: Number(p.d) }, wrongAnswer: r.wrongAnswer, count: r.count };
  });
}

export function createMinerPorts(store: Store, now: () => Date = () => new Date()): MinerPorts {
  const skillOf = (skillId: string) => {
    const entry = getSkillEntry(skillId);
    if (!entry) throw new Error(`Unknown skill: ${skillId}`);
    return entry.spec;
  };
  return {
    getUnknownErrors: (skillId) => unknownErrors(store, skillId),
    async existingMistakes(skillId) {
      const skill = skillOf(skillId);
      return [...skill.mistakes, ...(await minedMistakes(store, skill, ["APPROVED", "DRAFT_TESTED"]))];
    },
    async saveDraft(skillId, spec, report) {
      const id = `${spec.id}-${randomUUID().slice(0, 8)}`;
      await store.insertMinedMistake({
        id,
        skillId,
        source: JSON.stringify(spec),
        testsJson: JSON.stringify({
          reproduced: report.reproduced,
          checkedInstances: report.checkedInstances,
          overlaps: report.overlaps,
        }),
        status: "DRAFT_TESTED",
        approver: null,
        createdAt: now().toISOString(),
      });
      return id;
    },
  };
}
