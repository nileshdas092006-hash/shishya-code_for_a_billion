"use client";

import { useState, useTransition } from "react";
import { ReadyButton } from "../../_components/ReadyButton";

// The teacher's review of a mistake the AI Misconception Miner found. The teacher may rewrite the teacher label and
// the child message before approving; the formula cannot be changed here. Approving runs the code checks again.

export const REVIEW_WARNING = "Check the child message: the AI can be wrong about advice.";

export type LabelEdits = { label: string; childLabel: string };
export type Decide = (
  decision: "approved" | "rejected",
  edits?: LabelEdits,
) => Promise<{ ok: true } | { ok: false; reason: string }>;

export function MinedReviewForm({
  draft,
  decide,
}: {
  draft: { id: string; label: string; childLabel: string; answerFormula: string };
  decide: Decide;
}) {
  const [label, setLabel] = useState(draft.label);
  const [childLabel, setChildLabel] = useState(draft.childLabel);
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
      <label className="flex flex-col gap-1 font-semibold">
        Child message (what went wrong and the correct step, in NCERT words)
        <textarea
          name="childLabel"
          value={childLabel}
          onChange={(e) => setChildLabel(e.target.value)}
          rows={3}
          maxLength={300}
          className="field text-base"
        />
      </label>
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
