import { describe, expect, it } from "vitest";
import { en, type MessageKey } from "../en";
import { hi } from "../hi";
import { t } from "../index";

// Counts read right: "1 question", "2 questions" (live bug, 25 Oct: "wrong on 1 questions"). A message picks the
// form with {n|one|many}: the first form when n is 1, the second otherwise. Hindi does the same ("1 प्रश्न पर",
// "2 प्रश्नों पर").

const keys = Object.keys(en) as MessageKey[];
/** Every {name} and {name|…|…} in a message. */
const names = (s: string) => [...new Set([...s.matchAll(/\{(\w+)[}|]/g)].map((m) => m[1]))];
/** The message with every number in it set to n (other values are left as words). */
const withAll = (key: MessageKey, n: number, lang: "en" | "hi") =>
  t(key, Object.fromEntries(names(en[key]).map((name) => [name, n])), lang);

const EN_PLURALS = /\b(questions|students|children|answers|boxes|slips|calls|hours|codes|skills|tours|tries|lines|minutes|seconds)\b/;
const EN_SINGULARS = /\b(question|student|child|answer|box|slip|call|hour|code|skill|tour|try|line|minute|second)\b/;
/**
 * Up to 3 words between the number and its noun ("1 AI call", "2 logged wrong answers"), but not a linking word:
 * in "1 of 1000 questions" or "x = 2 in the question" the noun does not go with the number.
 */
const WORDS = "((?!(of|in|into|the|and|to|from|on|at|for|with|by|after|before|is|are)\\b)[A-Za-z]+ ){0,3}";
const HI_PLURALS = /(प्रश्नों|पर्चियाँ|डिब्बे|उत्तरों|बच्चों|घंटों)/;

describe("plurals", () => {
  it("t() picks the form for one or for many", () => {
    expect(t("board.unknown.evidence", { n: 1 })).toBe("wrong on 1 question");
    expect(t("board.unknown.evidence", { n: 2 })).toBe("wrong on 2 questions");
    expect(t("board.patterns.evidence", { n: 1 })).toBe("same step on 1 question");
    expect(t("board.patterns.evidence", { n: 3 })).toBe("same step on 3 questions");
    expect(t("board.unknown.evidence", { n: 1 }, "hi")).toBe("1 प्रश्न पर गलत");
    expect(t("board.unknown.evidence", { n: 2 }, "hi")).toBe("2 प्रश्नों पर गलत");
    expect(t("paper.grid.saved", { n: 1, right: 1 })).toBe("Saved 1 answer (1 right).");
    expect(t("paper.grid.already", { n: 1 })).toBe("1 box was already saved, so it was not changed.");
    expect(t("paper.grid.already", { n: 4 })).toBe("4 boxes were already saved, so they were not changed.");
    expect(t("map.nextTry.hours", { h: 1 })).toBe("Next try opens 1 hour after the missed proof");
    expect(t("board.cooldown.now", { h: 1 })).toBe("Now: the next try opens 1 h after a missed proof.");
  });

  it("no message says '1 questions', '1 students', '1 children' … in English", () => {
    for (const key of keys) {
      const one = withAll(key, 1, "en");
      const counted = [...one.matchAll(new RegExp(`\\b1 ${WORDS}${EN_PLURALS.source}`, "g"))];
      expect(counted.map((m) => m[0]), `${key}: ${one}`).toEqual([]);
      const two = withAll(key, 2, "en");
      expect(two.match(new RegExp(`\\b2 ${WORDS}${EN_SINGULARS.source}`)), `${key}: ${two}`).toBeNull();
    }
  });

  it("no message says '1 प्रश्नों' … in Hindi", () => {
    for (const key of keys) {
      const one = withAll(key, 1, "hi");
      expect(one.match(new RegExp(`(^|\\s)1 (\\S+ ){0,2}${HI_PLURALS.source}`)), `${key}: ${one}`).toBeNull();
    }
  });

  it("Hindi uses the same numbers as English, plural forms included", () => {
    for (const key of keys) expect(names(hi[key]).sort(), key).toEqual(names(en[key]).sort());
  });
});
