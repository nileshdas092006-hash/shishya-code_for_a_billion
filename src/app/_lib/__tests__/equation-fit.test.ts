import { describe, expect, it } from "vitest";
import { createRng } from "../../../core/rng";
import { SKILLS } from "../../../core/skills";
import { t } from "../../../i18n";
import { EQ_CHAR_EM, EQ_MIN_PX, fitFontPx, keepMathTogether } from "../equation-fit";

// The narrowest box an equation gets on a 360px phone: a Shishya line inside a card and a tappable button
// (page gutters 2×16, card padding 2×25, button padding and border 2×16 + 2×4).
const PHONE_LINE_BOX_PX = 360 - 32 - 50 - 40;

describe("fitFontPx", () => {
  it("shrinks long equations, never below the minimum or above the maximum", () => {
    expect(fitFontPx("x = 5", 300, 18, 45)).toBe(45);
    expect(fitFontPx("−12x − 11x − 12 = −12", 238, 18, 45)).toBeLessThan(45);
    expect(fitFontPx("−12x − 11x − 12 = −12 − 12 + 12 − 12", 100, 18, 45)).toBe(18);
  });

  it("every question and every Shishya line of every skill fits a 360px phone at ≥ the minimum size (1,000 seeds)", () => {
    let longest = "";
    for (const { spec, generateApply } of SKILLS) {
      for (let seed = 1; seed <= 1000; seed++) {
        const inst = spec.generate(createRng(seed));
        const texts = [
          inst.text,
          ...spec.solve(generateApply(createRng(seed)).instance).trace.map((l) => l.text),
          ...spec.solve(inst).trace.map((l) => l.text),
          ...spec.mistakes.flatMap((m) => m.apply(inst).trace.map((l) => l.text)),
        ];
        for (const text of texts) if (text.length > longest.length) longest = text;
      }
    }
    // needs no horizontal scroll at the minimum size
    expect(longest.length * EQ_CHAR_EM * EQ_MIN_PX, longest).toBeLessThanOrEqual(PHONE_LINE_BOX_PX);
  });
});

describe("keepMathTogether", () => {
  it("joins the parts of an equation inside a sentence with non-breaking spaces", () => {
    const out = keepMathTogether("Example: 3x + 1 = x + 31. Subtract x from both sides: 2x + 1 = 31.");
    expect(out).toContain("3x + 1 = x + 31.");
    expect(out).toContain("Subtract x from both sides:"); // ordinary words still wrap
    expect(keepMathTogether("x = −10x − 12")).toBe("x = −10x − 12");
  });

  it("is applied to child-facing text, so hints never split an equation", () => {
    expect(t("hint.alg.linear.both-sides.4")).toContain("3x + 1 = x + 31");
  });
});
