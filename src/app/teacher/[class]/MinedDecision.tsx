"use client";

import { useState, useTransition } from "react";
import { decideMined } from "../../actions";

// Approve / Reject for a mined mistake draft. Approving runs the code checks again on the server.

export function MinedDecision({ classCode, id }: { classCode: string; id: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (decision: "approved" | "rejected") =>
    startTransition(async () => {
      const r = await decideMined(classCode, id, decision);
      setMessage(r.ok ? null : r.reason);
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => decide("approved")}>
          Approve
        </button>
        <button type="button" className="btn" disabled={pending} onClick={() => decide("rejected")}>
          Reject
        </button>
      </div>
      {message && (
        <p role="alert" className="msg-bad">
          {message}
        </p>
      )}
    </div>
  );
}
