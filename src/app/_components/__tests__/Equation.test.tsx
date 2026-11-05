import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createRng } from "@/core/rng";
import { COLLEGE_SKILLS } from "@/core/skills";
import { fitText, isSentence, matrixRows } from "../../_lib/equation-fit";
import { Equation } from "../Equation";

// F12 Part 1. A college question is shown as what it is: a 2×2 matrix in two rows, and a dice question as a sentence
// that wraps on a phone. Every school equation stays on its one shrinking line.

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("reading a question's text", () => {
  it("[[3, −2], [4, 5]] is a matrix of two rows", () => {
    expect(matrixRows("[[3, −2], [4, 5]]")).toEqual([["3", "−2"], ["4", "5"]]);
    expect(matrixRows("4x − 3 = 2x + 7")).toBeNull();
    expect(matrixRows("−7 + 3")).toBeNull();
  });

  it("words are a sentence; equations and sums are not", () => {
    expect(isSentence("Two fair dice are rolled. What is the probability that the sum is 7?")).toBe(true);
    for (const eq of ["4x − 3 = 2x + 7", "−7 + 3", "x = 5", "3x + 5 − x + 2", "1/6 × 36 = 6", "[[3, −2], [4, 5]]"]) expect(isSentence(eq), eq).toBe(false);
  });
});

describe("a line too long for a phone", () => {
  it("closes up the spaces round × for display, and leaves every shorter line as it is", () => {
    expect(fitText("(−9) × (−8) − (−9) × (−9)")).toBe("(−9)×(−8) − (−9)×(−9)");
    expect(fitText("3 × 5 − (−2) × 4")).toBe("3 × 5 − (−2) × 4");
    expect(fitText("−12x − 11x − 12 = −12")).toBe("−12x − 11x − 12 = −12");
  });
});

describe("<Equation>", () => {
  it("draws a matrix as two rows, with the plain text for a screen reader", () => {
    const html = renderToStaticMarkup(<Equation text="[[3, −2], [4, 5]]" />);
    expect(text(html)).toBe("3 −2 4 5");
    expect(html).toContain('aria-label="[[3, −2], [4, 5]]"');
    expect(html).toMatch(/grid-cols-2/);
    expect(html).toMatch(/w-fit/); // never stretched across a card: its bars stay next to its numbers
    expect(html).not.toContain("nowrap");
  });

  it("lets a sentence wrap, with no one-line box to scroll sideways", () => {
    const sentence = "Two fair dice are rolled. What is the probability that the sum is 7?";
    const html = renderToStaticMarkup(<Equation text={sentence} />);
    expect(text(html)).toBe(sentence);
    expect(html).not.toContain("eq-box");
    expect(html).toContain("break-words");
  });

  it("keeps an equation on one line exactly as before", () => {
    const html = renderToStaticMarkup(<Equation text="4x − 3 = 2x + 7" />);
    expect(html).toContain("eq-box");
    expect(html).toContain("--eq-chars:15");
  });

  it("every college question and working line is one of these three things, and fits a 360 px phone when it is an equation", () => {
    for (const { spec } of COLLEGE_SKILLS) {
      for (let seed = 1; seed <= 300; seed++) {
        const inst = spec.generate(createRng(seed));
        for (const { text: line } of [...spec.solve(inst).trace, ...spec.mistakes.flatMap((m) => m.apply(inst).trace)]) {
          if (matrixRows(line) || isSentence(line)) continue;
          expect(fitText(line).length, line).toBeLessThanOrEqual(21); // PHONE_LINE_BOX_PX / (EQ_CHAR_EM × EQ_MIN_PX), see equation-fit.test.ts
        }
      }
    }
  });
});
