"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// The submit button of a plain server-action form whose action is slow (e.g. the Judge Tour's "Try it as a judge"
// and "Skip ahead"). It works before the page is ready, like any form button; once React has attached, it says
// what is happening and is disabled while the server works, so a tap is never met with silence or sent twice.

export function PendingSubmit({ className, pendingLabel, children }: { className: string; pendingLabel: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending ? true : undefined}>
      {pending ? pendingLabel : children}
    </button>
  );
}
