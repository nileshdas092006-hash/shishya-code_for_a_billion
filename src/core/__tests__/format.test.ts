import { describe, expect, it } from "vitest";
import { formatEquation, fracText } from "../format";
import { frac } from "../fraction";

describe("format", () => {
  it("prints equations with nice signs: no '+ −', coefficient 1 as x, −1 as −x", () => {
    expect(formatEquation([[4, true], [-3, false]], [[2, true], [7, false]])).toBe("4x − 3 = 2x + 7");
    expect(formatEquation([[1, true], [2, false]], [[-1, true], [8, false]])).toBe("x + 2 = −x + 8");
    expect(formatEquation([[-1, true]], [[-10, false]])).toBe("−x = −10");
  });

  it("prints fractions with the real minus sign", () => {
    expect(fracText(frac(5, 2))).toBe("5/2");
    expect(fracText(frac(-7, 5))).toBe("−7/5");
    expect(fracText(frac(10))).toBe("10");
  });
});
