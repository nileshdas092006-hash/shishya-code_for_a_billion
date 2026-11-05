import Link from "next/link";
import { Suspense } from "react";
import { t, type MessageKey } from "@/i18n";
import { getServices } from "@/server/instance";
import { joinChallengeAction } from "../../actions";
import { currentStudent } from "../../_lib/auth";
import { guardPage } from "../../_lib/page-guard";
import { Loading } from "../../_lib/student-pages";
import { Shishya } from "../../_components/Shishya";
import { GradeChoice, JoinNotice } from "./JoinParts";

// /join/<token>: the Shishya Challenge's one public link (F11). A student opens it alone on a phone, reads what
// happens to their answers (in English and Hindi), says which class they are in, and joins with a random code. A
// plain server-action form, so it works before the page is ready and with JavaScript off. Never asks for a name.
// A college-pack link (F12) has its own notice, with no parent line, and asks no class.

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
    const college = challenge.pack === "college";

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <Shishya mood="happy" size={90} />
          <h1 className="text-3xl font-extrabold break-words min-w-0">{challenge.title}</h1>
        </div>
        <p role="note" className="msg-note font-semibold">
          {t("app.isProgram")}
        </p>
        <JoinNotice college={college} />

        {already && (
          <section className="card flex flex-col items-start gap-3 border-green-700">
            <p className="text-xl font-semibold">{t("join.already", { code: already.code })}</p>
            <Link href="/s/challenge" className="btn btn-primary text-xl">
              {t("join.continue")}
            </Link>
            <p className="text-base text-gray-700">{t(college ? "join.someoneElse.college" : "join.someoneElse")}</p>
          </section>
        )}

        <form id="join" action={joinChallengeAction.bind(null, token)} className="card flex flex-col gap-4">
          {!college && <GradeChoice />}
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
