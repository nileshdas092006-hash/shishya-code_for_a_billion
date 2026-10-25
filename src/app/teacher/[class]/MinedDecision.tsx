"use client";

import { decideMined } from "../../actions";
import { MinedReviewForm, type ReviewDraft } from "./MinedReviewForm";

// Connects the review card to the server. Approving runs the code checks again on the server.

export function MinedDecision({ classCode, draft }: { classCode: string; draft: ReviewDraft }) {
  return <MinedReviewForm draft={draft} decide={(decision, edits) => decideMined(classCode, draft.id, decision, edits)} />;
}
