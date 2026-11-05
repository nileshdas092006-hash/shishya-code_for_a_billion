import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { hi } from "@/i18n/hi";
import { GradeChoice, JoinNotice } from "../[token]/JoinParts";

// F12 Part 2: the join page. A college link shows a plain notice worded for college students (no parent line), and
// never asks "Which class are you in?". The school page is unchanged.

describe("the notice", () => {
  it("school: the F11 words, with the parent line, in English and Hindi", () => {
    const html = renderToStaticMarkup(<JoinNotice college={false} />);
    expect(html).toContain("If you are under 13, please check with a parent first.");
    expect(html).toContain(hi["join.notice"]);
  });

  it("college: the same plain promises, with no parent line, in English and Hindi", () => {
    const html = renderToStaticMarkup(<JoinNotice college />).replaceAll("&#x27;", "'");
    expect(html).toContain(en["join.notice.college"]);
    expect(html).toContain(hi["join.notice.college"]);
    for (const promise of [/never ask your name, phone or email/, /random code/, /improve Shishya/, /total results/, /stop at any time/]) {
      expect(en["join.notice.college"]).toMatch(promise);
    }
    expect(html).not.toMatch(/parent/i);
    expect(html).not.toContain("माता-पिता");
    expect(hi["join.notice.college"]).not.toContain("13");
  });
});

describe("the class question", () => {
  it("school: classes 7 to 10, required", () => {
    const html = renderToStaticMarkup(<GradeChoice />);
    expect(html).toContain(en["join.grade"]);
    for (const g of [7, 8, 9, 10]) expect(html).toContain(`value="${g}"`);
    expect(html).toMatch(/required=""/);
  });

  it("the page asks it only for the school pack, and its form stays a plain server-action form", () => {
    const src = readFileSync(join(__dirname, "..", "[token]", "page.tsx"), "utf8");
    expect(src).toMatch(/\{!college && <GradeChoice \/>\}/);
    expect(src).toMatch(/<form[^>]*\baction=\{joinChallengeAction/);
  });
});
