"use client";

import { ReadyButton } from "../_components/ReadyButton";

export function PrintButton({ label }: { label: string }) {
  return (
    <ReadyButton type="button" className="btn no-print" onClick={() => window.print()}>
      {label}
    </ReadyButton>
  );
}
