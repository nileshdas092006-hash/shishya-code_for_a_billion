import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { computeImpact, type ImpactRows } from "@/server/impact";
import { ImpactView } from "../ImpactView";

// F12 Part 3: /impact shows both blocks under clear headings, the school block first, with one sentence under the
// college block, and nothing that a group under 5 would give away.

const NOW = new Date("2026-11-08T10:30:00.000Z");

function rows(): ImpactRows {
  const base: ImpactRows = {
    classes: [
      { id: "school", kind: "real", mode: "challenge", pack: "school" },
      { id: "college", kind: "real", mode: "challenge", pack: "college" },
    ],
    students: [],
    checks: [],
    feedback: [],
    wrongAnswers: [],
    mistakeLabels: {},
    mined: [],
  };
  const pre = [1, 2, 1, 2, 1];
  const post = [5, 6, 6, 5, 6];
  pre.forEach((p, i) => {
    const id = `c${i}`;
    base.students.push({ id, classId: "college", code: `UG-AAA${i + 2}`, selfGrade: null, studyArm: i % 2 ? "B" : "A" });
    base.checks.push({ studentId: id, phase: "pre", score: p }, { studentId: id, phase: "post", score: post[i] });
  });
  base.students.push({ id: "s1", classId: "school", code: "8C-AAA2", selfGrade: 8, studyArm: "A" });
  base.checks.push({ studentId: "s1", phase: "pre", score: 3 });
  base.feedback.push({ studentId: "c0", useful: 5, teachHelped: null, comment: "Determinants finally make sense", quoteOk: true, approved: true });
  return base;
}

const html = renderToStaticMarkup(<ImpactView impact={computeImpact(rows(), NOW)} />).replaceAll("&#x27;", "'");
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the impact page", () => {
  it("has the two headings, the school block first, and the sentence under the college block", () => {
    const school = html.indexOf(en["impact.school.heading"]);
    const college = html.indexOf(en["impact.college.heading"]);
    expect(school).toBeGreaterThan(-1);
    expect(college).toBeGreaterThan(school);
    expect(html.indexOf(en["impact.college.note"])).toBeGreaterThan(college);
    expect(en["impact.college.note"]).toBe("The same engine and the same checks, on two college topics, to test that Shishya's Skill Specification works beyond school algebra.");
    expect(html.match(/<h2/g)).toHaveLength(2);
  });

  it("keeps the school block's class levels and mistake finder; the college block has neither", () => {
    const collegeBlock = html.slice(html.indexOf(en["impact.college.heading"]));
    const schoolBlock = html.slice(0, html.indexOf(en["impact.college.heading"]));
    expect(schoolBlock).toContain(en["impact.byLevel.title"]);
    expect(schoolBlock).toContain(en["impact.miner.title"]);
    expect(collegeBlock).not.toContain(en["impact.byLevel.title"]);
    expect(collegeBlock).not.toContain(en["impact.miner.title"]);
    expect(collegeBlock).not.toContain("Class 7");
  });

  it("shows each block's own numbers: 5 college students shown, 1 school student's average not", () => {
    const collegeBlock = text.slice(text.indexOf(en["impact.college.heading"]));
    const schoolBlock = text.slice(0, text.indexOf(en["impact.college.heading"]));
    expect(collegeBlock).toContain("Average before: 1.4 of 6 → after: 5.6 of 6");
    expect(schoolBlock).not.toContain("Average before");
    expect(schoolBlock).toContain(en["impact.notShown"]);
    expect(collegeBlock).toContain("Determinants finally make sense");
    expect(schoolBlock).not.toContain("Determinants finally make sense");
  });

  it("no heading or section id is repeated, so the page's links and labels stay right", () => {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of html.matchAll(/aria-labelledby="([^"]+)"/g)) expect(ids).toContain(m[1]);
  });

  it("says how each block was worked out", () => {
    expect(html).toContain(en["impact.method"]);
    expect(html).toContain(en["impact.college.method"]);
    expect(en["impact.college.method"]).toMatch(/within each class from a random start/);
  });

  it("shows no student code", () => {
    expect(html).not.toMatch(/UG-AAA|8C-AAA/);
  });
});
