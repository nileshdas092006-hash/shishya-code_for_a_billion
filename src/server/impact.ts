import { paired, welch } from "./stats";
import type { CheckPhase, ClassKind, ClassMode, StudyArm } from "./store";

// The Shishya Challenge's public numbers (/impact and /api/impact), worked out by ONE pure function from the rows
// the service reads. Only REAL challenge classes count: never a trial run, a test class, a Judge Tour class or a
// classroom class. Any average over fewer than MIN_GROUP students is not shown, and nothing that names a student
// (a code, an id) or a class ever goes into the result. A comment appears only if the student allowed it to be
// quoted AND the organiser approved it.

export const MIN_GROUP = 5;
export const CLASS_LEVELS = [7, 8, 9, 10] as const;
export const CHECK_OUT_OF = 6;
export const DELAYED_OUT_OF = 4;
export const HONESTY_NOTE =
  "An online trial: students chose to join, did one session on their own phones, and there was no classroom teacher. Small numbers. Not a classroom study.";
export const SCOPE_NOTE = "Real Shishya Challenge classes only. Trial runs, test classes, Judge Tour classes and classroom classes are never counted.";
export const METHOD_NOTE =
  "Every check is scored again by code from its questions' seeds. Before → after uses only students who finished both checks, with a paired 95% t-interval. Groups were given at join (alternating within each class level from a random start) and are compared as given; the difference between groups uses Welch's 95% t-interval. Any average over fewer than 5 students is not shown.";

export type ImpactRows = {
  classes: { id: string; kind: ClassKind; mode: ClassMode }[];
  students: { id: string; classId: string; code: string; selfGrade: number | null; studyArm: StudyArm | null }[];
  /** Finished checks only matter: a check with no score is not finished. Scores are already re-checked from the seeds. */
  checks: { studentId: string; phase: CheckPhase; score: number | null }[];
  feedback: { studentId: string; useful: number; teachHelped: number | null; comment: string | null; quoteOk: boolean; approved: boolean | null }[];
  /** Wrong answers per student and mistake (mistakeId null: not diagnosed, e.g. a whole-number Ready check answer). */
  wrongAnswers: { studentId: string; skillId: string; mistakeId: string | null; count: number }[];
  /** "skillId|mistakeId" → the mistake's label. */
  mistakeLabels: Record<string, string>;
  /** Teacher-approved mistakes found by the mistake finder, with how many wrong answers from real classes each explains. */
  mined: { label: string; realWrongAnswers: number }[];
};

export type PairedResult =
  | { shown: true; n: number; before: number; after: number; difference: number; ci95: [number, number] }
  | { shown: false; n: number };
export type GroupDifference = { shown: true; nA: number; nB: number; difference: number; ci95: [number, number] } | { shown: false };
export type Average = { n: number; shown: true; average: number } | { n: number; shown: false };

/** Rounded to 2 places (and never "−0"). */
const r2 = (x: number) => {
  const v = Math.round(x * 100) / 100;
  return v === 0 ? 0 : v;
};

type Scored = { before: number; after: number };

function pairedResult(rows: Scored[]): PairedResult {
  if (rows.length < MIN_GROUP) return { shown: false, n: rows.length };
  const p = paired(
    rows.map((r) => r.before),
    rows.map((r) => r.after),
  );
  return { shown: true, n: p.n, before: r2(p.before), after: r2(p.after), difference: r2(p.difference), ci95: [r2(p.ci95[0]), r2(p.ci95[1])] };
}

function average(values: number[]): Average {
  if (values.length < MIN_GROUP) return { n: values.length, shown: false };
  return { n: values.length, shown: true, average: r2(values.reduce((s, v) => s + v, 0) / values.length) };
}

export function computeImpact(rows: ImpactRows, now: Date) {
  const counted = new Set(rows.classes.filter((c) => c.kind === "real" && c.mode === "challenge").map((c) => c.id));
  const students = rows.students.filter((s) => counted.has(s.classId) && s.selfGrade !== null && s.studyArm !== null);
  const ids = new Set(students.map((s) => s.id));
  const score = new Map<string, number>();
  for (const c of rows.checks) if (ids.has(c.studentId) && c.score !== null) score.set(`${c.studentId}|${c.phase}`, c.score);
  const of = (id: string, phase: CheckPhase) => score.get(`${id}|${phase}`);
  const withBoth = (list: typeof students) =>
    list.filter((s) => of(s.id, "pre") !== undefined && of(s.id, "post") !== undefined).map((s) => ({ ...s, before: of(s.id, "pre")!, after: of(s.id, "post")! }));

  const reachedOf = (list: typeof students) => ({
    joined: list.length,
    finishedBefore: list.filter((s) => of(s.id, "pre") !== undefined).length,
    finishedBoth: withBoth(list).length,
  });
  const atLevel = (level: number) => students.filter((s) => s.selfGrade === level);
  const both = withBoth(students);
  const groupA = both.filter((s) => s.studyArm === "A");
  const groupB = both.filter((s) => s.studyArm === "B");
  const gain = (s: Scored) => s.after - s.before;
  let difference: GroupDifference = { shown: false };
  if (groupA.length >= MIN_GROUP && groupB.length >= MIN_GROUP) {
    const w = welch(groupA.map(gain), groupB.map(gain));
    difference = { shown: true, nA: groupA.length, nB: groupB.length, difference: r2(w.difference), ci95: [r2(w.ci95[0]), r2(w.ci95[1])] };
  }

  const feedback = rows.feedback.filter((f) => ids.has(f.studentId));
  const levelOf = new Map(students.map((s) => [s.id, s.selfGrade!]));
  // a quote that holds any student's code (in any case) is left out: a code is a way to log in as that student
  const codes = rows.students.map((s) => s.code.toUpperCase());
  const quotes = feedback
    .filter((f) => f.approved === true && f.quoteOk === true && f.comment !== null && f.comment.trim() !== "")
    .filter((f) => !codes.some((c) => f.comment!.toUpperCase().includes(c)))
    .map((f) => {
      const level = levelOf.get(f.studentId)!;
      return { text: f.comment!.trim(), classLevel: atLevel(level).length >= MIN_GROUP ? level : null };
    })
    .sort((p, q) => p.text.localeCompare(q.text));

  const wrong = rows.wrongAnswers.filter((w) => ids.has(w.studentId));
  const explainedRows = wrong.filter((w) => w.mistakeId !== null && w.mistakeId !== "unknown");
  const total = wrong.reduce((s, w) => s + w.count, 0);
  const explained = explainedRows.reduce((s, w) => s + w.count, 0);
  const byMistake = new Map<string, number>();
  for (const w of explainedRows) byMistake.set(`${w.skillId}|${w.mistakeId}`, (byMistake.get(`${w.skillId}|${w.mistakeId}`) ?? 0) + w.count);
  const top = [...byMistake.entries()]
    .filter(([key]) => rows.mistakeLabels[key])
    .map(([key, count]) => ({ label: rows.mistakeLabels[key], count }))
    .sort((p, q) => q.count - p.count || p.label.localeCompare(q.label))
    .slice(0, 3);

  const mined = rows.mined.filter((m) => m.realWrongAnswers >= 1).sort((p, q) => q.realWrongAnswers - p.realWrongAnswers || p.label.localeCompare(q.label));
  const delayed = students.map((s) => of(s.id, "delayed")).filter((v): v is number => v !== undefined);

  return {
    title: "Shishya Challenge: results",
    generatedAt: now.toISOString(),
    scope: SCOPE_NOTE,
    honesty: HONESTY_NOTE,
    method: METHOD_NOTE,
    reached: { ...reachedOf(students), byClassLevel: CLASS_LEVELS.map((level) => ({ level, ...reachedOf(atLevel(level)) })) },
    scores: {
      outOf: CHECK_OUT_OF,
      all: pairedResult(both),
      byClassLevel: CLASS_LEVELS.map((level) => ({ level, result: pairedResult(both.filter((s) => s.selfGrade === level)) })),
      byGroup: { A: pairedResult(groupA), B: pairedResult(groupB), difference },
    },
    delayed: { outOf: DELAYED_OUT_OF, ...average(delayed) },
    mistakes: { wrongAnswers: total, explained, share: total === 0 ? null : r2(explained / total), top },
    miner: { count: mined.length, mistakes: mined.map((m) => ({ label: m.label, realWrongAnswers: m.realWrongAnswers })) },
    ratings: {
      useful: average(feedback.map((f) => f.useful)),
      teachHelped: average(feedback.map((f) => f.teachHelped).filter((v): v is number => v !== null)),
    },
    quotes,
  };
}

export type Impact = ReturnType<typeof computeImpact>;
