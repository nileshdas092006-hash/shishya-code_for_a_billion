import { afterEach, describe, expect, it } from "vitest";
import { answerText } from "../../core/answer";
import { diagnose } from "../../core/diagnose";
import { createRng } from "../../core/rng";
import { getSkillEntry } from "../../core/skills";
import { applies, type Instance } from "../../core/types";
import { createServices } from "../services";
import { openStore, type ClassKind, type Store } from "../store";
import { makeClock, setup, SKILL, tempDbUrl } from "./helpers";

// P1a. Paper Mode: a class with no computers does a printed worksheet; the teacher types each child's final
// answer into a grid. Those answers become real practice items and attempts (marked source 'paper'), diagnosed
// by the same src/core code as typed answers. Mastery is never changed by paper answers.

let ctx: Awaited<ReturnType<typeof setup>> | undefined;
let cleanup: (() => void) | undefined;
afterEach(() => {
  ctx?.done();
  ctx = undefined;
  cleanup?.();
  cleanup = undefined;
});

const entry = getSkillEntry(SKILL)!;
const questionOf = (seed: number): Instance => entry.spec.generate(createRng(seed));
/** The answer a known mistake gives on this question (src/core), and its id. */
function mistakeAnswer(inst: Instance, nth = 0) {
  const m = entry.spec.mistakes.filter((x) => applies(x, inst))[nth] ?? entry.spec.mistakes.filter((x) => applies(x, inst))[0];
  return { id: m.id, text: answerText(m.apply(inst).answer) };
}

async function sheetFor(svc: ReturnType<typeof createServices>, classId: string, count?: number) {
  const ws = await svc.createWorksheet(classId, SKILL, count);
  if (!ws.ok) throw new Error(ws.reason);
  return ws.worksheet;
}

describe("Paper Mode: the worksheet", () => {
  it("has 8 questions by default, a short code, and regenerates identically from its stored seeds", async () => {
    ctx = await setup();
    const ws = await sheetFor(ctx.svc, ctx.cls.id);
    expect(ws.code).toMatch(/^P-[A-Z2-9]{4}$/);
    expect(ws.seeds).toHaveLength(8);
    expect(ws.questions).toHaveLength(8);
    expect(new Set(ws.questions.map((q) => q.text)).size).toBe(8); // all different questions
    ws.seeds.forEach((seed, i) => expect(ws.questions[i].text).toBe(questionOf(seed).text));

    const again = await ctx.svc.getWorksheet(ctx.cls.id, ws.code);
    expect(again?.questions).toEqual(ws.questions);
    expect(again?.seeds).toEqual(ws.seeds);
    expect((await ctx.svc.listWorksheets(ctx.cls.id)).map((w) => w.code)).toEqual([ws.code]);
  });

  it("takes 1 to 20 questions, only for a known skill, and belongs to its own class only", async () => {
    ctx = await setup();
    expect((await sheetFor(ctx.svc, ctx.cls.id, 3)).questions).toHaveLength(3);
    expect(await ctx.svc.createWorksheet(ctx.cls.id, SKILL, 0)).toMatchObject({ ok: false });
    expect(await ctx.svc.createWorksheet(ctx.cls.id, SKILL, 21)).toMatchObject({ ok: false });
    expect(await ctx.svc.createWorksheet(ctx.cls.id, "alg.nothing", 8)).toMatchObject({ ok: false });
    const ws = await sheetFor(ctx.svc, ctx.cls.id);
    const other = await ctx.svc.createClass("KV8C", 8);
    expect(await ctx.svc.getWorksheet(other.id, ws.code)).toBeUndefined();
    expect(await ctx.svc.savePaperAnswers(other.id, ws.code, [{ studentCode: "8B-17", question: 1, text: "1" }])).toMatchObject({ ok: false });
  });
});

describe("Paper Mode: saving the answers", () => {
  it("saving N answers creates N practice attempts marked paper, each diagnosed by src/core; empty cells are not answered", async () => {
    ctx = await setup();
    const ws = await sheetFor(ctx.svc, ctx.cls.id);
    const insts = ws.seeds.map(questionOf);
    const entries = insts.map((inst, i) => ({
      studentCode: "8B-17",
      question: i + 1,
      text: i % 2 === 0 ? answerText(inst.answer) : mistakeAnswer(inst).text,
    }));
    entries[7].text = "  "; // left empty on paper: not answered
    const saved = await ctx.svc.savePaperAnswers(ctx.cls.id, ws.code, entries);
    expect(saved).toMatchObject({ ok: true, saved: 7, correct: 4, alreadySaved: [], unreadable: [] });

    const items = await ctx.store.listItems({ studentId: ctx.student.id, skillId: SKILL });
    expect(items).toHaveLength(7);
    expect(items.every((i) => i.kind === "practice" && i.format === "solve" && i.source === "paper")).toBe(true);
    const attempts = await ctx.store.listAttemptsForItems(items.map((i) => i.id));
    expect(attempts).toHaveLength(7);
    for (const a of attempts) {
      const item = items.find((i) => i.id === a.itemId)!;
      const inst = questionOf(item.seed);
      const q = ws.seeds.indexOf(item.seed);
      expect(q).toBeGreaterThanOrEqual(0);
      expect(a.correct).toBe(q % 2 === 0);
      if (q % 2 === 0) expect(a.mistakeId).toBeNull();
      else {
        const m = entry.spec.mistakes.find((x) => x.id === mistakeAnswer(inst).id)!;
        expect(a.mistakeId).toBe(diagnose(entry.spec, inst, m.apply(inst).answer));
        expect(a.mistakeId).toBe(m.id);
      }
    }

    // the grid shows each saved cell; the empty one is still empty
    const grid = (await ctx.svc.getWorksheet(ctx.cls.id, ws.code))!.grid;
    const row = grid.find((r) => r.code === "8B-17")!;
    expect(row.cells.filter((c) => c !== null)).toHaveLength(7);
    expect(row.cells[0]).toMatchObject({ correct: true });
    expect(row.cells[1]).toMatchObject({ correct: false });
    expect(row.cells[7]).toBeNull();
  });

  it("uses the forgiving parser: '−' and 'x = ' are read; an unreadable cell is not saved and is reported", async () => {
    ctx = await setup();
    const ws = await sheetFor(ctx.svc, ctx.cls.id, 2);
    const [a] = ws.seeds.map(questionOf);
    const typed = `x = ${answerText(a.answer).replace("-", "−")}`;
    const out = await ctx.svc.savePaperAnswers(ctx.cls.id, ws.code, [
      { studentCode: "8B-17", question: 1, text: typed },
      { studentCode: "8B-17", question: 2, text: "seven" },
    ]);
    expect(out).toMatchObject({ ok: true, saved: 1, correct: 1 });
    if (!out.ok) throw new Error("save");
    expect(out.unreadable).toEqual([{ studentCode: "8B-17", question: 2, text: "seven", errorKey: "answer.format" }]);
  });

  it("re-saving a cell never duplicates it: the saved answer stays and the cell is reported as already saved", async () => {
    ctx = await setup();
    const ws = await sheetFor(ctx.svc, ctx.cls.id, 2);
    const [a] = ws.seeds.map(questionOf);
    const cell = { studentCode: "8B-17", question: 1, text: answerText(a.answer) };
    await ctx.svc.savePaperAnswers(ctx.cls.id, ws.code, [cell]);
    const again = await ctx.svc.savePaperAnswers(ctx.cls.id, ws.code, [{ ...cell, text: "12345" }]);
    expect(again).toMatchObject({ ok: true, saved: 0, alreadySaved: [{ studentCode: "8B-17", question: 1 }] });
    const items = await ctx.store.listItems({ studentId: ctx.student.id, skillId: SKILL });
    expect(items).toHaveLength(1);
    const attempts = await ctx.store.listAttemptsForItems(items.map((i) => i.id));
    expect(attempts.map((x) => x.correct)).toEqual([true]);
  });

  it("only the class's own child codes and real question numbers are saved", async () => {
    ctx = await setup();
    const ws = await sheetFor(ctx.svc, ctx.cls.id, 2);
    const out = await ctx.svc.savePaperAnswers(ctx.cls.id, ws.code, [
      { studentCode: "8B-99", question: 1, text: "1" },
      { studentCode: "8B-17", question: 3, text: "1" },
      { studentCode: "8B-17", question: 0, text: "1" },
    ]);
    expect(out).toMatchObject({ ok: true, saved: 0 });
    expect(await ctx.store.listItems({ studentId: ctx.student.id, skillId: SKILL })).toEqual([]);
  });

  it("never changes mastery", async () => {
    ctx = await setup();
    await ctx.svc.teacherUnlock(ctx.student.id, SKILL);
    const before = await ctx.store.listMastery({ classId: ctx.cls.id });
    const ws = await sheetFor(ctx.svc, ctx.cls.id);
    const entries = ws.seeds.map((seed, i) => ({ studentCode: "8B-17", question: i + 1, text: answerText(questionOf(seed).answer) }));
    expect(await ctx.svc.savePaperAnswers(ctx.cls.id, ws.code, entries)).toMatchObject({ ok: true, saved: 8, correct: 8 });
    expect(await ctx.store.listMastery({ classId: ctx.cls.id })).toEqual(before);
    expect((await ctx.store.listEvents()).filter((e) => e.type === "mastery_changed")).toHaveLength(1); // only the unlock
  });

  it("feeds the board: the same mistake on 2 paper questions is a pattern, on 1 it is a slip", async () => {
    ctx = await setup();
    const other = await ctx.svc.createStudent(ctx.cls.id, "8B-18");
    const ws = await sheetFor(ctx.svc, ctx.cls.id);
    const insts = ws.seeds.map(questionOf);
    // a mistake that applies to the first two questions (every question has at least one)
    const shared = entry.spec.mistakes.find((m) => applies(m, insts[0]) && applies(m, insts[1]));
    if (!shared) throw new Error("no shared mistake on the first two questions");
    const wrong = (i: number) => answerText(shared.apply(insts[i]).answer);
    await ctx.svc.savePaperAnswers(ctx.cls.id, ws.code, [
      { studentCode: "8B-17", question: 1, text: wrong(0) },
      { studentCode: "8B-17", question: 2, text: wrong(1) },
      { studentCode: "8B-18", question: 1, text: wrong(0) },
    ]);
    const board = await ctx.svc.getStuckBoard(ctx.cls.id);
    expect(board.groups.find((g) => g.mistakeId === shared.id)?.studentCodes).toEqual(["8B-17"]);
    expect(board.slips.flatMap((s) => s.students.map((x) => x.code))).toEqual([other.code]);
  });

  it("the pilot CSV counts paper answers among practice answers, and says how many were on paper", async () => {
    ctx = await setup();
    const ws = await sheetFor(ctx.svc, ctx.cls.id, 3);
    const [a, b] = ws.seeds.map(questionOf);
    await ctx.svc.savePaperAnswers(ctx.cls.id, ws.code, [
      { studentCode: "8B-17", question: 1, text: answerText(a.answer) },
      { studentCode: "8B-17", question: 2, text: mistakeAnswer(b).text },
    ]);
    const [header, row] = (await ctx.svc.exportPilotCsv(ctx.cls.id)).trim().split("\n").map((l) => l.split(","));
    const rec = Object.fromEntries(header.map((h, i) => [h, row[i]]));
    expect(rec).toMatchObject({ skillId: SKILL, practiceAnswers: "2", practiceCorrect: "1", paperAnswers: "2", paperCorrect: "1" });
  });
});

describe("Paper Mode: pooled data from real classes only", () => {
  async function fresh() {
    const tmp = tempDbUrl();
    const store = await openStore({ url: tmp.url });
    const svc = createServices(store, { now: makeClock().now });
    cleanup = () => {
      store.close();
      tmp.cleanup();
    };
    return { store, svc };
  }
  let n = 0;
  async function classOfKind(store: Store, kind: ClassKind) {
    const id = `paper-${kind}-${++n}`;
    await store.insertClass({
      id,
      code: `P${n}-${kind.toUpperCase().slice(0, 4)}`,
      grade: 8,
      section: "B",
      aiAllowed: true,
      proofWindowRequired: false,
      proofWindowOpenUntil: null,
      kind,
      consentRecordedAt: "2026-10-20T09:00:00.000Z",
    });
    return id;
  }

  it("an answer no known mistake explains reaches unknownErrors only from a real class", async () => {
    const { store, svc } = await fresh();
    for (const kind of ["test", "sandbox", "real"] as const) {
      const classId = await classOfKind(store, kind);
      await svc.createStudent(classId, "8B-1");
      const ws = await svc.createWorksheet(classId, SKILL, 1);
      if (!ws.ok) throw new Error(ws.reason);
      const out = await svc.savePaperAnswers(classId, ws.worksheet.code, [{ studentCode: "8B-1", question: 1, text: "9999" }]);
      expect(out).toMatchObject({ ok: true, saved: 1, correct: 0 });
      expect((await store.listUnknownErrors(SKILL)).length, kind).toBe(kind === "real" ? 1 : 0);
    }
    expect((await store.listUnknownErrors(SKILL))[0]).toMatchObject({ wrongAnswer: "9999", count: 1 });
  });
});
