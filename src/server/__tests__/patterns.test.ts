import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { answerText } from "../../core/answer";
import { createRng } from "../../core/rng";
import { linearBothSides } from "../../core/skills/linear-both-sides";
import { defaultRegistry } from "../skills";
import { SKILL, setup } from "./helpers";

// A careless slip is not a misconception. A child joins a mistake group on the stuck board only when the SAME
// mistake explained their answers on at least 2 DIFFERENT questions in the last 7 days; one match is a slip.
// On the Practise screen a first match gets only a neutral "Check line N again."; the mistake is named from the
// second different question on.

let ctx: Awaited<ReturnType<typeof setup>>;
afterEach(() => ctx?.done());

const mistakeOf = (id: string) => linearBothSides.mistakes.find((m) => m.id === id)!;

/** Answers a fresh practice item with the answer a given mistake produces (or a given text). */
async function practiseWith(studentId: string, mistakeId: string | null, text?: string) {
  const served = await ctx.svc.servePracticeItem(studentId, SKILL);
  if (!served.ok) throw new Error(served.reason);
  const item = (await ctx.store.getItem(served.itemId))!;
  const inst = linearBothSides.generate(createRng(item.seed));
  const answer = text ?? (mistakeId ? answerText(mistakeOf(mistakeId).apply(inst).answer) : item.answer);
  return ctx.svc.submitPracticeAnswer(served.itemId, answer);
}

async function students(codes: string[]) {
  const ids: Record<string, string> = {};
  for (const code of codes) {
    ids[code] = (await ctx.svc.createStudent(ctx.cls.id, code)).id;
    await ctx.svc.teacherUnlock(ids[code], SKILL);
  }
  return ids;
}

describe("stuck board: a pattern needs two different questions", () => {
  it("one matching question is a slip; two or more different ones make a pattern with N questions", async () => {
    ctx = await setup();
    const s = await students(["8B-01", "8B-02", "8B-03", "8B-04", "8B-05"]);

    await practiseWith(s["8B-04"], "forgot-to-divide"); // 8 days ago: outside the window
    ctx.clock.advanceHours(8 * 24);
    await practiseWith(s["8B-04"], "forgot-to-divide"); // so only one in the window: a slip
    await practiseWith(s["8B-01"], "kept-x-sign");
    await practiseWith(s["8B-01"], "kept-x-sign");
    await practiseWith(s["8B-01"], "dropped-constant");
    await practiseWith(s["8B-02"], "kept-x-sign");
    for (let i = 0; i < 3; i++) await practiseWith(s["8B-03"], "kept-const-sign");
    await practiseWith(s["8B-05"], null, "1000");

    const board = await ctx.svc.getStuckBoard(ctx.cls.id);
    // unknown last, bigger groups first, then by id
    expect(board.groups.map((g) => [g.mistakeId, g.count, g.studentCodes])).toEqual([
      ["kept-const-sign", 1, ["8B-03"]],
      ["kept-x-sign", 1, ["8B-01"]],
      ["unknown", 1, ["8B-05"]],
    ]);
    expect(board.groups[0].students).toEqual([{ code: "8B-03", questions: 3, line: 3 }]);
    expect(board.groups[1].students).toEqual([{ code: "8B-01", questions: 2, line: 2 }]);

    expect(board.slips).toEqual([
      {
        skillId: SKILL,
        students: [
          { code: "8B-02", line: 2 },
          { code: "8B-04", line: 5 },
        ],
      },
    ]);
    const grouped = board.groups.flatMap((g) => g.studentCodes);
    for (const slip of board.slips.flatMap((x) => x.students)) expect(grouped).not.toContain(slip.code);
  });

  it("the grid counts patterns (not slips, not unknown) by the line where they first go wrong", async () => {
    ctx = await setup();
    const s = await students(["8B-01", "8B-02", "8B-03", "8B-04", "8B-05", "8B-06"]);
    for (const code of ["8B-01", "8B-02"]) for (let i = 0; i < 2; i++) await practiseWith(s[code], "kept-x-sign"); // L2
    for (let i = 0; i < 2; i++) await practiseWith(s["8B-03"], "dropped-constant"); // L3
    for (let i = 0; i < 2; i++) await practiseWith(s["8B-04"], "forgot-to-divide"); // L5
    await practiseWith(s["8B-05"], "kept-const-sign"); // a slip at L3: not in the grid
    for (let i = 0; i < 2; i++) await practiseWith(s["8B-06"], null, "1000"); // unknown: not in the grid

    const board = await ctx.svc.getStuckBoard(ctx.cls.id);
    expect(board.grid.lines).toEqual([2, 3, 4, 5]);
    expect(board.grid.rows.map((r) => r.skillId)).toEqual(Object.keys(defaultRegistry)); // every skill, in teaching order
    const row = board.grid.rows.find((r) => r.skillId === SKILL)!;
    expect(row.counts).toEqual([2, 1, 0, 1]);
    for (const other of board.grid.rows.filter((r) => r.skillId !== SKILL)) expect(other.counts).toEqual([0, 0, 0, 0]);

    // every cell equals the group counts by line
    for (const r of board.grid.rows) {
      board.grid.lines.forEach((line, i) => {
        const fromGroups = board.groups
          .filter((g) => g.skillId === r.skillId && g.mistakeId !== "unknown")
          .flatMap((g) => g.students)
          .filter((st) => st.line === line).length;
        expect(r.counts[i], `${r.skillId} L${line}`).toBe(fromGroups);
      });
    }
  });

  it("two items with identical questions count as one question", async () => {
    ctx = await setup();
    const inst = linearBothSides.generate(createRng(4242));
    const wrong = answerText(mistakeOf("kept-x-sign").apply(inst).answer);
    for (const id of ["dup-1", "dup-2"]) {
      await ctx.store.insertItem({
        id,
        studentId: ctx.student.id,
        skillId: SKILL,
        version: linearBothSides.version,
        seed: 4242,
        kind: "practice",
        format: "solve",
        runId: null,
        mistakeId: null,
        paramsJson: JSON.stringify(inst.params),
        answer: answerText(inst.answer),
        servedAt: ctx.clock.now().toISOString(),
      });
      await ctx.store.insertAttempt({
        id: randomUUID(),
        studentId: ctx.student.id,
        itemId: id,
        answer: wrong,
        correct: false,
        mistakeId: "kept-x-sign",
        createdAt: ctx.clock.now().toISOString(),
      });
    }
    const board = await ctx.svc.getStuckBoard(ctx.cls.id);
    expect(board.groups).toEqual([]);
    expect(board.slips).toEqual([{ skillId: SKILL, students: [{ code: "8B-17", line: 2 }] }]);
  });

  it("a real pattern wins over more unknown answers", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    for (let i = 0; i < 3; i++) await practiseWith(ctx.student.id, null, "1000");
    for (let i = 0; i < 2; i++) await practiseWith(ctx.student.id, "kept-x-sign");
    const board = await ctx.svc.getStuckBoard(ctx.cls.id);
    expect(board.groups.map((g) => [g.mistakeId, g.studentCodes])).toEqual([["kept-x-sign", ["8B-17"]]]);
  });
});

describe("practise: a first match gets only a neutral pointer", () => {
  it("first match → 'Check line N again.' and no mistake label; a second different question → the child label", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const keptX = mistakeOf("kept-x-sign");

    const first = await practiseWith(ctx.student.id, "kept-x-sign");
    expect(first).toEqual({ ok: true, correct: false, mistakeId: null, checkLine: 2, feedback: "Check line 2 again." });
    // another mistake does not count towards this one
    expect(await practiseWith(ctx.student.id, "dropped-constant")).toMatchObject({ mistakeId: null, checkLine: 3 });

    const second = await practiseWith(ctx.student.id, "kept-x-sign");
    expect(second).toEqual({ ok: true, correct: false, mistakeId: "kept-x-sign", checkLine: null, feedback: keptX.childLabel });

    // the teacher's data still records what really happened
    const attempts = (await ctx.store.listClassMistakesSince(ctx.cls.id, "2000-01-01")).map((h) => h.mistakeId);
    expect(attempts).toEqual(["kept-x-sign", "dropped-constant", "kept-x-sign"]);
  });

  it("a match older than 7 days does not count; unknown and correct answers are as before", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    await practiseWith(ctx.student.id, "kept-x-sign");
    ctx.clock.advanceHours(8 * 24);
    expect(await practiseWith(ctx.student.id, "kept-x-sign")).toMatchObject({ mistakeId: null, checkLine: 2 });
    expect(await practiseWith(ctx.student.id, null, "1000")).toMatchObject({ correct: false, mistakeId: "unknown", checkLine: null });
    expect(await practiseWith(ctx.student.id, null)).toMatchObject({ correct: true, mistakeId: null, checkLine: null });
  });
});
