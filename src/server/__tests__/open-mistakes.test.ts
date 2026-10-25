import { afterEach, describe, expect, it } from "vitest";
import { SKILLS } from "../../core/skills";
import { mistakesResponse } from "../open-mistakes";
import { setup, SKILL } from "./helpers";

// P1c. GET /api/mistakes: Shishya's mistake library as open data. Every skill's authored mistakes and the
// teacher-APPROVED mined ones, as specs, with the skill id and version, the licence and a link to SKILL_SPEC.md.
// Never any child data: no codes, no answers, no counts, no drafts or rejected items, no AI suggestion text.

let ctx: Awaited<ReturnType<typeof setup>> | undefined;
afterEach(() => {
  ctx?.done();
  ctx = undefined;
});

const AI_TEXT = "AI SUGGESTED CHILD TEXT";
const mined = (id: string) =>
  JSON.stringify({
    id,
    label: `Divides by a too early (${id})`,
    childLabel: `${AI_TEXT} ${id}`,
    stepType: "divide",
    firstWrongLine: 5,
    lines: { "5": "x = {(d - b) / a}" },
    answerFormula: "(d - b) / a",
  });

async function withLibrary() {
  ctx = await setup();
  const { store, svc, student } = ctx;
  const row = (id: string, status: "APPROVED" | "DRAFT_TESTED" | "REJECTED") => ({
    id,
    skillId: SKILL,
    source: mined(id),
    testsJson: JSON.stringify({ reproduced: 17, checkedInstances: 1000, overlaps: {} }),
    status,
    approver: status === "DRAFT_TESTED" ? null : "teacher of class 8B-K7QM",
    createdAt: "2026-10-20T09:00:00.000Z",
  });
  await store.insertMinedMistake(row("divide-early-ok", "APPROVED"));
  await store.insertMinedMistake(row("divide-early-draft", "DRAFT_TESTED"));
  await store.insertMinedMistake(row("divide-early-no", "REJECTED"));
  // a child's own wrong answer, which must never appear
  await svc.teacherUnlock(student.id, SKILL);
  const item = await svc.servePracticeItem(student.id, SKILL);
  if (!item.ok) throw new Error(item.reason);
  await svc.submitPracticeAnswer(item.itemId, "98765");
  return ctx;
}

type Library = {
  licence: string;
  spec: string;
  skills: { skillId: string; version: string; mistakes: Record<string, unknown>[] }[];
};

async function read() {
  const res = await mistakesResponse(async () => ctx!.svc);
  return { res, body: (await res.json()) as Library };
}

const ALLOWED = new Set([
  "licence", "spec", "about", "skills",
  "skillId", "version", "statement", "answerKind", "mistakes",
  "id", "label", "stepType", "origin", "firstWrongLine", "lines", "answerFormula",
  "example", "question", "working", "result",
]);

/** Every key in the JSON, except the line numbers inside a mined mistake's "lines". */
function keys(v: unknown, parent = ""): string[] {
  if (Array.isArray(v)) return v.flatMap((x) => keys(x, parent));
  if (v && typeof v === "object") {
    return Object.entries(v).flatMap(([k, x]) => [...(parent === "lines" ? [] : [k]), ...keys(x, k)]);
  }
  return [];
}

describe("GET /api/mistakes", () => {
  it("has every skill with its id and version, the MIT licence and a link to SKILL_SPEC.md, cached for 5 minutes", async () => {
    await withLibrary();
    const { res, body } = await read();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(body.licence).toBe("MIT");
    expect(body.spec).toMatch(/^https:\/\/github\.com\/.+\/docs\/SKILL_SPEC\.md$/);
    expect(body.skills.map((s) => [s.skillId, s.version])).toEqual(SKILLS.map(({ spec }) => [spec.id, spec.version]));
  });

  it("contains every authored mistake, with its step type and a worked example made by src/core", async () => {
    await withLibrary();
    const { body } = await read();
    for (const { spec } of SKILLS) {
      const skill = body.skills.find((s) => s.skillId === spec.id)!;
      for (const m of spec.mistakes) {
        const out = skill.mistakes.find((x) => x.id === m.id);
        expect(out, `${spec.id} ${m.id}`).toMatchObject({ id: m.id, label: m.label, stepType: m.stepType, origin: "authored" });
        const example = out!.example as { question: string; working: string[]; result: string };
        expect(example.working[0]).toBe(example.question);
        expect(out!.firstWrongLine).toBeGreaterThanOrEqual(2);
        expect(out!.firstWrongLine).toBeLessThanOrEqual(example.working.length);
      }
    }
  });

  it("contains a teacher-approved mined mistake as its spec (lines and answer formula)", async () => {
    await withLibrary();
    const { body } = await read();
    const m = body.skills.find((s) => s.skillId === SKILL)!.mistakes.find((x) => x.id === "divide-early-ok");
    expect(m).toMatchObject({
      origin: "mined",
      label: "Divides by a too early (divide-early-ok)",
      stepType: "divide",
      firstWrongLine: 5,
      lines: { "5": "x = {(d - b) / a}" },
      answerFormula: "(d - b) / a",
    });
  });

  it("never contains a draft, a rejected one, the AI's suggestion text, or any field that could hold child data", async () => {
    const c = await withLibrary();
    const { body } = await read();
    const text = JSON.stringify(body);
    expect(text).not.toContain("divide-early-draft");
    expect(text).not.toContain("divide-early-no");
    expect(text).not.toContain(AI_TEXT);
    for (const secret of [c.student.code, c.student.id, c.cls.code, c.cls.id, "8B-K7QM", "98765", "teacher of class"]) {
      expect(text, secret).not.toContain(secret);
    }
    expect(keys(body).filter((k) => !ALLOWED.has(k))).toEqual([]);
  });

  it("a mined row that no longer loads is left out instead of breaking the export", async () => {
    await withLibrary();
    await ctx!.store.insertMinedMistake({
      id: "broken",
      skillId: SKILL,
      source: "{not json",
      testsJson: "{}",
      status: "APPROVED",
      approver: "teacher",
      createdAt: "2026-10-20T09:00:00.000Z",
    });
    const { res, body } = await read();
    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("broken");
  });

  it("answers 503 { ok: false } with no details when the database cannot be read", async () => {
    await withLibrary();
    ctx!.store.close();
    const res = await mistakesResponse(async () => ctx!.svc);
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.text()).toBe(JSON.stringify({ ok: false }));
  });
});
