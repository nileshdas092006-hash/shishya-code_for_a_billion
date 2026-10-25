import { describe, expect, it } from "vitest";
import { CHILD_MESSAGES_EN, CHILD_MESSAGES_HI, childMessage, childMessageKey } from "../childMessages";
import { NOT_NCERT } from "../minedMistake";
import type { StepType } from "../types";

// The fixed, human-written messages a child sees for a MINED mistake (never the AI's words).

const STEP_TYPES: StepType[] = ["move-x", "move-const", "simplify", "divide", "sign", "operation"];

describe("child messages for mined mistakes", () => {
  it("every StepType has English and Hindi text", () => {
    for (const step of STEP_TYPES) {
      expect(CHILD_MESSAGES_EN[childMessageKey(step)]?.trim(), step).toBeTruthy();
      expect(CHILD_MESSAGES_HI[childMessageKey(step)]?.trim(), step).toBeTruthy();
    }
    expect(Object.keys(CHILD_MESSAGES_EN).sort()).toEqual(STEP_TYPES.map(childMessageKey).sort());
    expect(Object.keys(CHILD_MESSAGES_HI).sort()).toEqual(STEP_TYPES.map(childMessageKey).sort());
  });

  it("uses NCERT language: never 'move' or 'change the sign'", () => {
    for (const text of [...Object.values(CHILD_MESSAGES_EN), ...Object.values(CHILD_MESSAGES_HI)]) {
      expect(text).not.toMatch(NOT_NCERT);
    }
    expect(Object.values(CHILD_MESSAGES_EN).some((text) => /do the same operation on both sides/.test(text))).toBe(true);
  });

  it("code fills in the line numbers, in either language", () => {
    for (const step of STEP_TYPES) {
      for (const lang of ["en", "hi"] as const) {
        const text = childMessage(step, 5, lang);
        expect(text, `${step} ${lang}`).toContain("5");
        expect(text, `${step} ${lang}`).not.toMatch(/\{\w+\}/);
      }
    }
    expect(childMessage("divide", 5)).toContain("line 4");
  });

  it("Hindi keeps the same {placeholders} as English", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const step of STEP_TYPES) expect(names(CHILD_MESSAGES_HI[childMessageKey(step)])).toEqual(names(CHILD_MESSAGES_EN[childMessageKey(step)]));
  });
});
