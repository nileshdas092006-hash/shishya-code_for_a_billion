import { describe, expect, it } from "vitest";
import { createRng, randInt } from "../rng";

describe("seeded rng (mulberry32)", () => {
  it("gives the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("gives different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("remembers its seed", () => {
    expect(createRng(7).seed).toBe(7);
  });

  it("returns numbers in [0, 1) and whole numbers in range", () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = randInt(rng, -12, 12);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(-12);
      expect(n).toBeLessThanOrEqual(12);
    }
  });
});
