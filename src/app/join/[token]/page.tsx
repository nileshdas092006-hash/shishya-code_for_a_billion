import Link from "next/link";
import { Suspense } from "react";
import { t, type MessageKey } from "@/i18n";
import { getServices } from "@/server/instance";
import { CHALLENGE_GRADES } from "@/server/services";
import { joinChallengeAction } from "../../actions";
import { currentStudent } from "../../_lib/auth";
import { guardPage } from "../../_lib/page-guard";
import { Loading } from "../../_lib/student-pages";
import { Shishya } from "../../_components/Shishya";

// /join/<token>: the Shishya Challenge's one public link (F11). A student opens it alone on a phone, reads what
// happens to their answers (in English and Hindi), says which class they are in, and joins with a random code. A
// plain server-action form, so it works before the page is ready and with JavaScript off. Never asks for a name.

const ERRORS: Record<string, MessageKey> = {
  grade: "join.error.grade",
  busy: "join.error.busy",
  full: "join.error.full",
  setup: "setup.missing",
};

export default function JoinPage({ params, searchParams }: PageProps<"/join/[token]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Join params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Query = Promise<Record<string, string | string[] | undefined>>;

function Join({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Query }) {
  return guardPage("student", async () => {
    const token = decodeURIComponent((await params).token);
    const svc = await getServices();
    const challenge = await svc.challengeByToken(token);
    if (!challenge) {
      return (
        <div className="flex flex-col items-start gap-4">
          <p className="msg-note text-xl">{t("join.notFound")}</p>
          <p lang="hi" className="text-lg">
            {t("join.notFound", undefined, "hi")}
          </p>
        </div>
      );
    }
    const e = (await searchParams).e;
    const error = typeof e === "string" ? ERRORS[e] : undefined;
    const me = await currentStudent();
    const already = me && me.classId === challenge.classId ? me : null;

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <Shishya mood="happy" size={90} />
          <h1 className="text-3xl font-extrabold break-words min-w-0">{challenge.title}</h1>
        </div>
        <p role="note" className="msg-note font-semibold">
          {t("app.isProgram")}
        </p>
        <section className="card flex flex-col gap-3">
          <p className="text-lg">{t("join.notice")}</p>
          <p lang="hi" className="text-lg">
            {t("join.notice", undefined, "hi")}
          </p>
        </section>

        {already && (
          <section className="card flex flex-col items-start gap-3 border-green-700">
            <p className="text-xl font-semibold">{t("join.already", { code: already.code })}</p>
            <Link href="/s/challenge" className="btn btn-primary text-xl">
              {t("join.continue")}
            </Link>
            <p className="text-base text-gray-700">{t("join.someoneElse")}</p>
          </section>
        )}

        <form id="join" action={joinChallengeAction.bind(null, token)} className="card flex flex-col gap-4">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-2xl font-bold">
              {t("join.grade")}{" "}
              <span lang="hi" className="block text-lg font-semibold">
                {t("join.grade", undefined, "hi")}
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {CHALLENGE_GRADES.map((g) => (
                <label key={g} className="flex min-h-14 items-center gap-3 rounded-lg border-2 border-gray-400 px-3 py-2 text-xl font-semibold">
                  <input type="radio" name="grade" value={g} required className="h-6 w-6 shrink-0" />
                  {t("join.gradeOption", { n: g })}
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="msg-bad text-lg">
              {t(error)}
            </p>
          )}
          <button type="submit" className="btn btn-primary text-2xl self-start">
            {t("join.start")}
          </button>
        </form>
      </div>
    );
  });
}
