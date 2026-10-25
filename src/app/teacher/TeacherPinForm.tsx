"use client";

import Link from "next/link";
import { useActionState } from "react";
import { t } from "@/i18n";
import { teacherLogin } from "../actions";

export function TeacherPinForm({ classCode }: { classCode?: string }) {
  const [state, action, pending] = useActionState(teacherLogin, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <label className="flex flex-col gap-1 font-semibold">
        Class code
        <input
          name="classCode"
          required
          defaultValue={classCode}
          readOnly={Boolean(classCode)}
          autoComplete="off"
          className="field uppercase"
        />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Teacher PIN
        <input name="pin" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="off" className="field" />
      </label>
      <button type="submit" className="btn btn-primary self-end" disabled={pending}>
        Open
      </button>
      {state.error && (
        <p role="alert" className="msg-bad sm:col-span-3">
          {state.error}
        </p>
      )}
      <Link href="/teacher/recover" className="underline self-start sm:col-span-3">
        {t("recover.link")}
      </Link>
    </form>
  );
}
