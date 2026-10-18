import { describe, expect, it } from "vitest";
import { parseEquation, type Equation } from "../equation";
import { createRng } from "../rng";
import { linearBothSides } from "../skills/linear-both-sides";
import { meetsTargetForm } from "../targetForm";

function parse(text: string): Equation {
  const r = parseEquation(text);
  if (!r.ok) throw new Error(r.error);
  return r.equation;
}

describe("meetsTargetForm", () => {
  it.each([
    // line 2: no x-term on the right
    [2, "4x - 2x - 3 = 7", true],
    [2, "2x - 3 = 7", true],
    [2, "4x - 3 = 2x + 7", false],
    [2, "-3 = -4x + 2x + 7", false],
    // line 3: only x-terms on the left, only numbers on the right
    [3, "4x - 2x = 7 + 3", true],
    [3, "2x = 10", true],
    [3, "4x - 2x - 3 = 7", false],
    [3, "4x = 2x + 10", false],
    // line 4: one x-term = one number
    [4, "2x = 10", true],
    [4, "4x - 2x = 10", false],
    [4, "2x = 7 + 3", false],
    // line 5: exactly x = one number
    [5, "x = 5", true],
    [5, "2x = 10", false],
    [5, "x = 2 + 3", false],
    [5, "5 = x", false],
  ] as const)("line %i: %s → %s", (line, text, expected) => {
    expect(meetsTargetForm(parse(text), line)).toBe(expected);
  });

  it("property: every correct trace line meets its own target form (1,000 seeds)", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const trace = linearBothSides.solve(linearBothSides.generate(createRng(seed))).trace;
      for (const line of [2, 3, 4, 5] as const) {
        expect(meetsTargetForm(parse(trace[line - 1].text), line), `seed ${seed} L${line}`).toBe(true);
      }
    }
  });
});
