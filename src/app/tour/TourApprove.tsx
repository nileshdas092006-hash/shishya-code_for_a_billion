"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { ReadyButton } from "../_components/ReadyButton";

// The tour's "Approve" on the recorded Miner draft: it only explains. It calls nothing and saves nothing.

export function TourApprove() {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col items-start gap-3">
      <ReadyButton type="button" className="btn btn-primary" onClick={() => setShown(true)}>
        {t("tour.agent.approve")}
      </ReadyButton>
      {shown && (
        <p role="status" className="msg-note">
          {t("tour.agent.approveNote")}
        </p>
      )}
    </div>
  );
}
