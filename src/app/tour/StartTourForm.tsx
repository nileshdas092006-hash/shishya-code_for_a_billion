"use client";

import { useActionState } from "react";
import { t } from "@/i18n";
import { startJudgeTour } from "../actions";
import { PendingSubmit } from "../_components/PendingSubmit";

// "Try it as a judge": a plain server-action form, so it works even before the page is ready. While the server
// sets up the made-up class (a few seconds), the button says so and is disabled.

export function StartTourForm() {
  const [state, action] = useActionState(startJudgeTour, {});
  return (
    <form action={action} className="flex flex-col items-center gap-2 w-full max-w-xl">
      <PendingSubmit className="btn w-full text-xl min-h-16 border-amber-700 bg-amber-100" pendingLabel={t("tour.starting")}>
        {t("home.tour")}
      </PendingSubmit>
      <p className="text-base text-gray-700">{t("home.tourNote")}</p>
      {state.error && (
        <p role="alert" className="msg-bad">
          {t(state.error)}
        </p>
      )}
    </form>
  );
}
