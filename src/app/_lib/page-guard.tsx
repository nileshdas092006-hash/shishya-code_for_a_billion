import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { t } from "@/i18n";
import { isSetupError } from "@/server/instance";
import { logServerError } from "@/server/setup";

// Pages that need a login never show "This page couldn't load". A missing server setting or any other server
// error becomes a friendly message; the real cause goes to the server log only. redirect() and notFound()
// still work (unstable_rethrow hands them back to Next.js).

export const SETUP_MISSING_TEACHER =
  "Shishya is not set up yet: the server is missing a setting. Ask the person who set it up to check the settings.";
export const SOMETHING_WRONG_TEACHER = "Something went wrong on the server. Please reload the page in a minute.";

export async function guardPage(audience: "student" | "teacher", render: () => Promise<ReactNode>): Promise<ReactNode> {
  try {
    return await render();
  } catch (e) {
    unstable_rethrow(e);
    logServerError(`${audience} page`, e);
    const setup = isSetupError(e);
    const text =
      audience === "student" ? t(setup ? "setup.missing" : "common.error") : setup ? SETUP_MISSING_TEACHER : SOMETHING_WRONG_TEACHER;
    return (
      <p role="alert" className="msg-note text-xl">
        {text}
      </p>
    );
  }
}

/** For a child with no valid login (none, expired, or from another server). */
export function LoggedOutNotice() {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="msg-note text-xl">{t("login.again")}</p>
      <Link href="/s" className="btn btn-primary text-xl">
        {t("login.againLink")}
      </Link>
    </div>
  );
}
