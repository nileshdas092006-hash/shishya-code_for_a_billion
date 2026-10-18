import { describe, expect, it } from "vitest";
import { ANSWER_MESSAGES } from "../../core/answer";
import { PARSE_MESSAGES } from "../../core/equation";
import { SKILLS } from "../../core/skills";
import { TEACH_MESSAGES } from "../../core/teach";
import { en } from "../en";
import { hi } from "../hi";
import { hintKey, mistakeKey, skillKey, t } from "../index";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("i18n", () => {
  it("Hindi has exactly the same keys as English", () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
  });

  it("no string is empty, and Hindi keeps the same {placeholders}", () => {
    for (const key of Object.keys(en)) {
      expect(en[key].trim(), key).not.toBe("");
      expect(hi[key].trim(), key).not.toBe("");
      expect(placeholders(hi[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it("English child text uses NCERT language (no 'move', no 'change the sign')", () => {
    for (const [key, text] of Object.entries(en)) {
      expect(text.toLowerCase(), key).not.toMatch(/\bmov(e|es|ed|ing)\b|change (the|its) sign/);
    }
  });

  it("every skill has a title, an example, 4 hints and a child label for every mistake", () => {
    for (const { spec } of SKILLS) {
      expect(en[skillKey(spec.id, "title")]).toBeTruthy();
      expect(en[skillKey(spec.id, "example")]).toBeTruthy();
      spec.hintLadder.forEach((h, i) => expect(en[hintKey(spec.id, i + 1)]).toBe(h));
      for (const m of spec.mistakes) expect(en[mistakeKey(spec.id, m.id)]).toBe(m.childLabel);
    }
  });

  it("English matches the messages src/core produces", () => {
    for (const [key, text] of Object.entries({ ...TEACH_MESSAGES, ...PARSE_MESSAGES, ...ANSWER_MESSAGES })) {
      expect(en[key], key).toBe(text);
    }
  });

  it("t() fills placeholders in either language", () => {
    expect(t("teach.tap.tooLate", { line: 3 })).toBe(TEACH_MESSAGES["teach.tap.tooLate"].replace("{line}", "3"));
    expect(t("teach.tap.tooLate", { line: 3 }, "hi")).toContain("3");
    expect(t("app.isProgram")).toMatch(/computer program/);
  });
});
