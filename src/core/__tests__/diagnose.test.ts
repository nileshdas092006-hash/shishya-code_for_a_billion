import { asFraction } from "../answer";
import { describe, expect, it } from "vitest";
import { diagnose } from "../diagnose";
import { add, frac } from "../fraction";
import { createRng } from "../rng";
import { linearBothSides, makeInstance } from "../skills/linear-both-sides";
import type { SkillSpec } from "../types";

const SEEDS = Array.from({ length: 1000 }, (_, i) => i + 1);

describe("diagnose", () => {
  const inst = makeInstance({ a: 4, b: -3, c: 2, d: 7 }, 0);

  it("names the mistake for each example answer", () => {
    expect(diagnose(linearBothSides, inst, frac(5, 3))).toBe("kept-x-sign");
    expect(diagnose(linearBothSides, inst, frac(7, 2))).toBe("dropped-constant");
    expect(diagnose(linearBothSides, inst, frac(2))).toBe("kept-const-sign");
    expect(diagnose(linearBothSides, inst, frac(10))).toBe("forgot-to-divide");
  });

  it("says unknown for divide-by-a (5/2), which is not authored on purpose", () => {
    expect(diagnose(linearBothSides, inst, frac(5, 2))).toBe("unknown");
  });

  it("says unknown when more than one mistake matches", () => {
    const twin = { ...linearBothSides.mistakes[0], id: "twin" };
    const spec: SkillSpec = { ...linearBothSides, mistakes: [linearBothSides.mistakes[0], twin] };
    expect(diagnose(spec, inst, frac(5, 3))).toBe("unknown");
  });

  it("property: returns the right id for every mistake's answer over 1,000 seeds", () => {
    for (const seed of SEEDS) {
      const q = linearBothSides.generate(createRng(seed));
      for (const m of linearBothSides.mistakes) {
        expect(diagnose(linearBothSides, q, m.apply(q).answer), `seed ${seed}`).toBe(m.id);
      }
    }
  });

  it("property: a wrong answer no mistake produces gives unknown over 1,000 seeds", () => {
    for (const seed of SEEDS) {
      const q = linearBothSides.generate(createRng(seed));
      expect(diagnose(linearBothSides, q, add(asFraction(q.answer), frac(1000)))).toBe("unknown");
    }
  });
});
