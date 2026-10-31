"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { ReadyButton } from "./ReadyButton";

// "Copy" next to a link the organiser shares (a challenge's join link). The link itself is always shown as text
// too, so it can be copied by hand on a phone where the clipboard is not allowed.

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
  }
  return (
    <span className="flex flex-wrap items-center gap-3">
      <ReadyButton type="button" className="btn" onClick={copy}>
        {state === "done" ? t("copy.done") : t("copy.button")}
      </ReadyButton>
      {state === "failed" && (
        <span role="status" className="text-base text-amber-900">
          {t("copy.failed")}
        </span>
      )}
    </span>
  );
}
