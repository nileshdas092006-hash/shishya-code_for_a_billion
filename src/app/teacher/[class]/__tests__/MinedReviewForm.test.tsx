import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MinedReviewForm, REVIEW_WARNING } from "../MinedReviewForm";

const draft = {
  id: "divided-by-a-1234",
  label: "Divided by the original coefficient a",
  childLabel: "Divide both sides by the number in front of x in the collected line.",
  answerFormula: "(d - b) / a",
};
const decide = async () => ({ ok: true as const });

describe("the teacher's review card for a mined mistake", () => {
  const html = renderToStaticMarkup(<MinedReviewForm draft={draft} decide={decide} />);

  it("shows a clear warning that the AI can be wrong about advice", () => {
    expect(REVIEW_WARNING).toBe("Check the child message: the AI can be wrong about advice.");
    expect(html).toContain(REVIEW_WARNING);
  });

  it("lets the teacher edit the teacher label and the child message, prefilled with the AI's text", () => {
    expect(html).toMatch(/<textarea[^>]*name="label"[^>]*>Divided by the original coefficient a<\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*name="childLabel"[^>]*>Divide both sides by the number in front of x in the collected line\.<\/textarea>/);
  });

  it("shows the formula but does not let the teacher edit it", () => {
    expect(html).toContain("(d - b) / a");
    expect(html).not.toMatch(/name="answerFormula"/);
  });

  it("has Approve and Reject", () => {
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
  });
});
