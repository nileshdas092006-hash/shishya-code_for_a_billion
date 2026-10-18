"use client";

import { useActionState } from "react";
import { t } from "@/i18n";
import { loginStudent } from "../actions";

export function StudentLoginForm() {
  const [state, action, pending] = useActionState(loginStudent, {});
  return (
    <form action={action} className="card flex flex-col gap-4 w-full max-w-md">
      <label className="flex flex-col gap-1 font-semibold">
        {t("login.classCode")}
        <input name="classCode" required autoComplete="off" autoCapitalize="characters" className="field uppercase" />
        <span className="text-base font-normal text-gray-700">{t("login.classCodeHint")}</span>
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        {t("login.studentCode")}
        <input name="studentCode" required autoComplete="off" autoCapitalize="characters" className="field uppercase" />
        <span className="text-base font-normal text-gray-700">{t("login.studentCodeHint")}</span>
      </label>
      {state.error && (
        <p role="alert" className="msg-bad">
          {t(state.error)}
        </p>
      )}
      <button type="submit" className="btn btn-primary text-xl" disabled={pending}>
        {t("login.go")}
      </button>
    </form>
  );
}
