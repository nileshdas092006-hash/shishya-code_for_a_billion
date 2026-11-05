"use client";

import Link from "next/link";
import { useActionState } from "react";
import { t } from "@/i18n";
import { createChallengeAction, type CreateChallengeState } from "../actions";
import { CopyButton } from "../_components/CopyButton";

// "Create a challenge link (online, no classroom)": one public link for students who join alone (F11). The tick
// about running it online is the class's consent record. The PIN and recovery code are shown once, here.

export function CreateChallengeForm() {
  const [state, action, pending] = useActionState<CreateChallengeState, FormData>(createChallengeAction, { status: "idle" });

  if (state.status === "created") {
    return (
      <section className="card flex flex-col gap-3 border-green-700 no-print">
        <h2 className="text-2xl font-bold">{t("create.challenge.ready")}</h2>
        <p className="text-xl font-semibold break-words">{state.title}</p>
        {state.trial && <p className="msg-note">{t("create.challenge.trialNote")}</p>}
        {state.pack === "college" && <p className="msg-note">{t("create.challenge.collegeReady")}</p>}
        <p className="text-xl">{t("create.challenge.link")}</p>
        <p className="math text-lg font-bold break-all">{state.link}</p>
        <CopyButton text={state.link} />
        <p className="text-xl">
          {t("create.challenge.classCode")} <strong className="math text-3xl">{state.classCode}</strong>
        </p>
        <p className="text-xl">
          {t("create.challenge.pin")} <strong className="math text-3xl">{state.pin}</strong>
        </p>
        <p className="msg-note">{t("create.challenge.pinNote")}</p>
        <p className="text-xl">
          {t("create.recovery")} <strong className="math text-2xl break-all">{state.recoveryCode}</strong>
        </p>
        <p className="msg-note">{t("create.recoveryNote")}</p>
        <Link href={`/teacher/${encodeURIComponent(state.classCode)}`} className="btn btn-primary self-start">
          {t("create.challenge.board")}
        </Link>
      </section>
    );
  }

  const error = state.status === "error" ? state : null;
  return (
    <section className="card flex flex-col gap-4 no-print">
      <h2 className="text-2xl font-bold">{t("create.challenge.title")}</h2>
      <p>{t("create.challenge.intro")}</p>
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 font-semibold">
          {t("create.challenge.name")}
          <input
            name="title"
            required
            maxLength={60}
            defaultValue={error?.title ?? ""}
            placeholder={t("create.challenge.namePlaceholder")}
            autoComplete="off"
            className="field"
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">{t("create.challenge.pack")}</legend>
          <label className="flex items-start gap-3 text-lg">
            <input type="radio" name="pack" value="school" defaultChecked={error?.pack !== "college"} className="mt-1 h-6 w-6 shrink-0" />
            <span>{t("create.challenge.pack.school")}</span>
          </label>
          <label className="flex items-start gap-3 text-lg">
            <input type="radio" name="pack" value="college" defaultChecked={error?.pack === "college"} className="mt-1 h-6 w-6 shrink-0" />
            <span>{t("create.challenge.pack.college")}</span>
          </label>
          <p className="text-base text-gray-700">{t("create.challenge.pack.collegeNote")}</p>
        </fieldset>
        <label className="flex items-start gap-3 text-lg">
          <input type="checkbox" name="trial" defaultChecked={error?.trial ?? false} className="mt-1 h-6 w-6 shrink-0" />
          <span>{t("create.challenge.trial")}</span>
        </label>
        <label className="flex items-start gap-3 text-lg">
          <input type="checkbox" name="online" required className="mt-1 h-6 w-6 shrink-0" />
          <span>{t("create.challenge.online")}</span>
        </label>
        <button type="submit" className="btn btn-primary self-start" disabled={pending}>
          {t("create.challenge.submit")}
        </button>
      </form>
      {error && (
        <p role="alert" className="msg-bad">
          {error.error ? t(error.error) : error.message}
        </p>
      )}
    </section>
  );
}
