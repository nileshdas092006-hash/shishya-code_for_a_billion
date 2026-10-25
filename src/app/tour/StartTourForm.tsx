"use client";

import { useActionState } from "react";
import { t } from "@/i18n";
import { startJudgeTour } from "../actions";

// "Try it as a judge": a plain server-action form, so it works even before the page is ready.

export function StartTourForm() {
  const [state, action, pending] = useActionState(startJudgeTour, {});
  return (
    <form action={action} className="flex flex-col items-center gap-2 w-full max-w-xl">
      <button type="submit" className="btn w-full text-xl min-h-16 border-amber-700 bg-amber-100" disabled={pending}>
        {t("home.tour")}
      </button>
      <p className="text-base text-gray-700">{t("home.tourNote")}</p>
      {state.error && (
        <p role="alert" className="msg-bad">
          {t(state.error)}
        </p>
      )}
    </form>
  );
}
