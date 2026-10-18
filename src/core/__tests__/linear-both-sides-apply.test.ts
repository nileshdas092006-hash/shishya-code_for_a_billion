import { describe, expect, it } from "vitest";
import { add, equals, frac, mul } from "../fraction";
import { createRng } from "../rng";
import { generateApply } from "../skills/linear-both-sides-apply";

const SEEDS = Array.from({ length: 1000 }, (_, i) => i + 1);

describe("apply item: taxi fares", () => {
  it("property: 1,000 seeds meet every constraint and the answer satisfies the equation", () => {
    for (const seed of SEEDS) {
      const item = generateApply(createRng(seed));
      const { a, b, c, d } = item.instance.params;
      expect(item.instance.skillId).toBe("alg.linear.both-sides");
      expect(item.instance.seed).toBe(seed);
      for (const perKm of [a, c]) {
        expect(Number.isInteger(perKm)).toBe(true);
        expect(perKm).toBeGreaterThanOrEqual(8);
        expect(perKm).toBeLessThanOrEqual(30);
      }
      for (const fixed of [b, d]) {
        expect(Number.isInteger(fixed)).toBe(true);
        expect(fixed).toBeGreaterThanOrEqual(20);
        expect(fixed).toBeLessThanOrEqual(300);
      }
      expect(a).not.toBe(c);
      expect(b).not.toBe(d);
      const x = item.instance.answer;
      expect(x.den).toBe(1);
      expect(x.num).toBeGreaterThan(0);
      expect(x.num).toBeLessThanOrEqual(50);
      expect(equals(add(mul(frac(a), x), frac(b)), add(mul(frac(c), x), frac(d)))).toBe(true);
    }
  });

  it("puts the same numbers in the English and Hindi text, without the answer", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const { instance, text, textHi } = generateApply(createRng(seed));
      const { a, b, c, d } = instance.params;
      for (const t of [text, textHi]) {
        for (const n of [a, b, c, d]) expect(t).toContain(`₹${n}`);
      }
      expect(text).toContain("Taxi A");
      expect(textHi).toContain("टैक्सी A");
    }
  });

  it("is the same item for the same seed", () => {
    expect(generateApply(createRng(7))).toEqual(generateApply(createRng(7)));
  });
});
