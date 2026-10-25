import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stateWord } from "../../app/_lib/state-words";
import { en, ui } from "../en";
import { hi } from "../hi";
import { t } from "../index";

// F8: plain words a teacher (or a judge) can read without a glossary. Internal state names (LOCKED, OPEN, KEY1,
// NOT_YET, MASTERED) stay in the code; only the words on screen change.

const screenKeys = Object.keys(ui);
const APP = join(__dirname, "..", "..", "app");

/** Every .tsx file under src/app, tests left out. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : tsxFiles(path);
    return name.endsWith(".tsx") ? [path] : [];
  });
}

/** The file without its comments, so only code and on-screen text are left. */
const withoutComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("plain words on every screen", () => {
  it("the skill states have plain names in English", () => {
    expect(en["map.state.LOCKED"]).toBe("Not started");
    expect(en["map.state.OPEN"]).toBe("Practising");
    expect(en["map.state.KEY1"]).toBe("Taught the Shishya");
    expect(en["map.state.NOT_YET"]).toBe("Next try opens tomorrow");
    expect(en["map.state.MASTERED"]).toBe("Mastered");
    expect(en["map.prove"]).toBe("Show it alone");
    expect(en["prove.title"]).toBe("Show it alone");
  });

  it("no English screen text uses the old words", () => {
    for (const key of screenKeys) {
      expect(en[key], key).not.toMatch(/\bkey ?1\b|\bprove( it)?\b|\bnot yet\b|\b(un)?locked\b|misconception miner|\bmined\b|\bunknown\b|cooldown/i);
    }
  });

  it("no Hindi screen text uses the old words, and every new Hindi line is marked for review", () => {
    const old = /चाबी 1|साबित|अभी नहीं|मिसकंसेप्शन|Misconception|^बंद$|^खुला$/;
    for (const key of screenKeys) expect(hi[key], key).not.toMatch(old);
    const source = readFileSync(join(__dirname, "..", "hi.ts"), "utf8").split("\n");
    for (const key of ["map.state.LOCKED", "map.state.OPEN", "map.state.KEY1", "map.state.NOT_YET", "map.prove", "prove.title"]) {
      const line = source.find((l) => l.trimStart().startsWith(`"${key}":`));
      expect(line, key).toMatch(/HINDI-REVIEW/);
    }
  });

  it("the next-try words follow the class's setting; a time is shown when it is known", () => {
    expect(t(...stateWord("NOT_YET", 24))).toBe("Next try opens tomorrow");
    expect(t(...stateWord("NOT_YET", 1))).toBe("Next try opens next period");
    expect(t(...stateWord("NOT_YET", 0))).toBe("Next try is open now");
    expect(t(...stateWord("NOT_YET", 48))).toBe("Next try opens 48 hours after the missed proof");
    expect(t(...stateWord("NOT_YET"))).toBe("Next try opens tomorrow");
    expect(t(...stateWord("KEY1", 1))).toBe("Taught the Shishya");
    expect(en["prove.retryAt"]).toBe("Your next try opens at {time}.");
  });

  it("a mistake the code cannot match, and the AI helper, are named in plain words", () => {
    expect(en["board.unknown.title"]).toBe("Not matched to a known mistake");
    expect(en["board.mined.title"]).toBe("New mistakes found in your class");
    expect(en["tour.agent.title"]).toMatch(/mistake finder \(an AI helper\)/);
    expect(en["agentRuns.intro"]).toMatch(/mistake finder \(an AI helper\)/);
  });

  it("no page has the old words written straight into it", () => {
    for (const file of tsxFiles(APP)) {
      const code = withoutComments(readFileSync(file, "utf8"));
      expect(code, file).not.toMatch(/Key 1|Prove it|Not yet|Misconception Miner|>\s*Locked\s*</);
    }
  });

  it("no screen shows a raw mistake id or tool name next to its plain words", () => {
    const board = withoutComments(readFileSync(join(APP, "teacher", "[class]", "ClassBoardView.tsx"), "utf8"));
    expect(board).not.toMatch(/\{group\.mistakeId\}|\{spec\.id\}|\{draft\.id\}/);
    expect(withoutComments(readFileSync(join(APP, "teacher", "[class]", "agent", "page.tsx"), "utf8"))).not.toMatch(/\{a\.id\}/);
    expect(withoutComments(readFileSync(join(APP, "tour", "AgentRun.tsx"), "utf8"))).not.toMatch(/\(\{c\.tool\}\)/);
  });
});
