"use client";

import Link from "next/link";
import { useActionState } from "react";
import { t } from "@/i18n";
import { recoverPinAction, type RecoverPinState } from "../../actions";

// "Forgot the PIN?": class code + recovery code → a new PIN and a new recovery code, both shown once.

export function RecoverPinForm() {
  const [state, action, pending] = useActionState<RecoverPinState, FormData>(recoverPinAction, { status: "idle" });

  if (state.status === "done") {
    return (
      <div className="card flex flex-col gap-3 border-green-700">
        <h2 className="text-2xl font-bold">{t("recover.done", { code: state.classCode })}</h2>
        <p className="text-xl">
          {t("recover.newPin")} <strong className="math text-3xl">{state.pin}</strong>
        </p>
        <p className="text-xl">
          {t("recover.newCode")} <strong className="math text-2xl break-all">{state.recoveryCode}</strong>
        </p>
        <p className="msg-note">{t("recover.note")}</p>
        <Link href={`/teacher/${encodeURIComponent(state.classCode)}`} className="btn btn-primary self-start">
          {t("recover.open")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <label className="flex flex-col gap-1 font-semibold">
        {t("recover.classCode")}
        <input
          name="classCode"
          required
          defaultValue={state.status === "error" ? state.classCode : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          className="field uppercase"
        />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        {t("recover.code")}
        <input name="recoveryCode" required maxLength={30} autoComplete="off" autoCapitalize="characters" className="field uppercase" />
      </label>
      <button type="submit" className="btn btn-primary self-end" disabled={pending}>
        {t("recover.go")}
      </button>
      {state.status === "error" && (
        <p role="alert" className="msg-bad sm:col-span-3">
          {t(state.error)}
        </p>
      )}
    </form>
  );
}
