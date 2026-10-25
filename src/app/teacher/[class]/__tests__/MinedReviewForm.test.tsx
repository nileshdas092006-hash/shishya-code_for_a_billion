import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { MinedReviewForm, REVIEW_WARNING } from "../MinedReviewForm";

const draft = {
  id: "divided-by-a-1234",
  label: "Divided by the original coefficient a",
  childText: "Look again at line 5. Divide both sides by the number in front of x in line 4.",
  aiChildLabel: "Divide by the coefficient of x in the original equation.",
  answerFormula: "(d - b) / a",
};
const decide = async () => ({ ok: true as const });

describe("the teacher's review card for a mined mistake", () => {
  const html = renderToStaticMarkup(<MinedReviewForm draft={draft} decide={decide} />).replace(/&#x27;/g, "'");

  it("shows a clear warning that the AI can be wrong about advice", () => {
    expect(REVIEW_WARNING).toBe("Check the child message: the AI can be wrong about advice.");
    expect(html).toContain(REVIEW_WARNING);
  });

  it("lets the teacher edit the teacher label and what the child will see, prefilled with the fixed message (not the AI's)", () => {
    expect(html).toMatch(/<textarea[^>]*name="label"[^>]*>Divided by the original coefficient a<\/textarea>/);
    expect(html).toContain(en["review.childSees"]);
    expect(html).toMatch(/<textarea[^>]*name="childLabel"[^>]*>Look again at line 5\. Divide both sides by the number in front of x in line 4\.<\/textarea>/);
  });

  it("shows the AI's suggestion in its own box, read-only, marked as only for the teacher", () => {
    expect(en["review.aiSuggestion"]).toBe("AI's suggestion (only you see this)");
    expect(html).toContain(en["review.aiSuggestion"]);
    expect(html).toContain(draft.aiChildLabel);
    expect(html).not.toMatch(/<textarea[^>]*>Divide by the coefficient of x in the original equation\.<\/textarea>/);
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
