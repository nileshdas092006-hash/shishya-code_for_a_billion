"use client";

import { useState, useTransition } from "react";
import { t } from "@/i18n";
import { ReadyButton } from "../../_components/ReadyButton";

// The teacher's review of a mistake the AI Misconception Miner found. The teacher may rewrite the teacher label and
// what the child will see before approving; the formula cannot be changed here. Approving runs the code checks again.
// The child box starts with the fixed, human-written message for the mistake's step type: children never see the
// AI's own child message, which is shown in a separate, read-only box for the teacher only.

export const REVIEW_WARNING = "Check the child message: the AI can be wrong about advice.";

export type LabelEdits = { label: string; childLabel: string };
export type Decide = (
  decision: "approved" | "rejected",
  edits?: LabelEdits,
) => Promise<{ ok: true } | { ok: false; reason: string }>;

export type ReviewDraft = {
  id: string;
  label: string;
  /** What the child will see: the fixed message for the step type. */
  childText: string;
  /** The AI's own child message: shown to the teacher only. */
  aiChildLabel: string;
  answerFormula: string;
};

export function MinedReviewForm({ draft, decide }: { draft: ReviewDraft; decide: Decide }) {
  const [label, setLabel] = useState(draft.label);
  const [childLabel, setChildLabel] = useState(draft.childText);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = (decision: "approved" | "rejected") =>
    startTransition(async () => {
      const r = await decide(decision, decision === "approved" ? { label, childLabel } : undefined);
      setMessage(r.ok ? null : r.reason);
    });

  return (
    <div className="flex flex-col gap-3">
      <p role="note" className="msg-note font-bold">
        {REVIEW_WARNING}
      </p>
      <label className="flex flex-col gap-1 font-semibold">
        Teacher label (names the mistake)
        <textarea name="label" value={label} onChange={(e) => setLabel(e.target.value)} rows={2} maxLength={300} className="field text-base" />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 font-semibold">
          {t("review.childSees")}
          <textarea
            name="childLabel"
            value={childLabel}
            onChange={(e) => setChildLabel(e.target.value)}
            rows={4}
            maxLength={300}
            className="field text-base"
          />
          <span className="text-base font-normal text-gray-700">{t("review.childSeesNote")}</span>
        </label>
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{t("review.aiSuggestion")}</p>
          <p className="rounded border-2 border-dashed border-gray-400 p-2 text-base break-words">{draft.aiChildLabel}</p>
          <p className="text-base text-gray-700">{t("review.aiSuggestionNote")}</p>
        </div>
      </div>
      <p className="text-base">
        Wrong answer it predicts (cannot be edited here): <span className="math font-bold">x = {draft.answerFormula}</span>
      </p>
      <div className="flex flex-wrap gap-3">
        <ReadyButton type="button" className="btn btn-primary" disabled={pending} onClick={() => send("approved")}>
          Approve
        </ReadyButton>
        <ReadyButton type="button" className="btn" disabled={pending} onClick={() => send("rejected")}>
          Reject
        </ReadyButton>
      </div>
      {message && (
        <p role="alert" className="msg-bad">
          {message}
        </p>
      )}
    </div>
  );
}
