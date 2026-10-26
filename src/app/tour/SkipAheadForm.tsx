"use client";

import { t } from "@/i18n";
import { skipAheadInTour } from "../actions";
import { PendingSubmit } from "../_components/PendingSubmit";

// Stop 3's "Skip ahead": a plain server-action form, so it works even before the page is ready. While the server
// finishes the teaching, the button says so and is disabled.

export function SkipAheadForm() {
  return (
    <form action={skipAheadInTour}>
      <PendingSubmit className="btn btn-primary text-xl" pendingLabel={t("tour.skipping")}>
        {t("tour.skip")}
      </PendingSubmit>
    </form>
  );
}
