"use client";

import { decideMined } from "../../actions";
import { MinedReviewForm } from "./MinedReviewForm";

// Connects the review card to the server. Approving runs the code checks again on the server.

export function MinedDecision({
  classCode,
  draft,
}: {
  classCode: string;
  draft: { id: string; label: string; childLabel: string; answerFormula: string };
}) {
  return <MinedReviewForm draft={draft} decide={(decision, edits) => decideMined(classCode, draft.id, decision, edits)} />;
}
