import { describe, expect, it } from "vitest";
import { add, div, equals, frac, mul, sub, toString } from "../fraction";

describe("fraction", () => {
  it("is always simplified with a positive denominator", () => {
    expect(frac(10, 4)).toEqual({ num: 5, den: 2 });
    expect(frac(3, -6)).toEqual({ num: -1, den: 2 });
    expect(frac(-4, -2)).toEqual({ num: 2, den: 1 });
    expect(frac(0, -5)).toEqual({ num: 0, den: 1 });
  });

  it("rejects a zero denominator", () => {
    expect(() => frac(1, 0)).toThrow();
    expect(() => div(frac(1), frac(0))).toThrow();
  });

  it("does arithmetic exactly", () => {
    expect(add(frac(1, 2), frac(1, 3))).toEqual(frac(5, 6));
    expect(sub(frac(1, 2), frac(1, 2))).toEqual(frac(0));
    expect(mul(frac(2, 3), frac(3, 4))).toEqual(frac(1, 2));
    expect(div(frac(10), frac(6))).toEqual(frac(5, 3));
  });

  it("compares by value", () => {
    expect(equals(frac(2, 4), frac(1, 2))).toBe(true);
    expect(equals(frac(1, 2), frac(-1, 2))).toBe(false);
  });

  it("prints like 5/3, 5 and -7/2", () => {
    expect(toString(frac(5, 3))).toBe("5/3");
    expect(toString(frac(10, 2))).toBe("5");
    expect(toString(frac(7, -2))).toBe("-7/2");
    expect(toString(frac(0, 3))).toBe("0");
  });
});
