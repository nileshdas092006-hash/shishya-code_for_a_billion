import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/i18n";
import { getServices } from "@/server/instance";
import { logoutStudent } from "../../actions";
import { currentStudent } from "../../_lib/auth";
import { guardPage, LoggedOutNotice } from "../../_lib/page-guard";
import { Loading } from "../../_lib/student-pages";
import { SkillCardHeader } from "./SkillCardHeader";

export default function StudentHome() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-extrabold">{t("map.title")}</h1>
      <Suspense fallback={<Loading />}>
        <SkillMap />
      </Suspense>
    </div>
  );
}

function SkillMap() {
  return guardPage("student", async () => {
    const student = await currentStudent();
    if (!student) return <LoggedOutNotice />;
    const skills = await (await getServices()).getSkillMap(student.studentId);
    return (
      <>
        <p className="text-lg text-gray-700">{student.code}</p>
        <ol className="flex flex-col gap-4">
          {skills.map(({ skillId, state, recheck }) => {
            const path = encodeURIComponent(skillId);
            return (
              <li key={skillId} className="card flex flex-col gap-3">
                <SkillCardHeader skillId={skillId} state={state} cooldownHours={student.proofCooldownHours} />
                {recheck === "passed" && <p className="text-lg font-bold text-green-800">{t("recheck.passed")}</p>}
                {recheck === "again" && <p className="msg-note text-lg">{t("recheck.again.map")}</p>}
                {recheck === "due" && (
                  <Link href={`/s/recheck/${path}`} className="btn btn-primary self-start">
                    {t("recheck.link")}
                  </Link>
                )}
                {state === "LOCKED" ? (
                  <p className="text-lg">{t("map.locked")}</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <Link href={`/s/practise/${path}`} className="btn btn-primary">
                      {t("map.practise")}
                    </Link>
                    <Link href={`/s/teach/${path}`} className="btn">
                      {t("map.teach")}
                    </Link>
                    {(state === "KEY1" || state === "NOT_YET") && (
                      <Link href={`/s/prove/${path}`} className="btn">
                        {t("map.prove")}
                      </Link>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <form action={logoutStudent}>
          <button type="submit" className="btn">
            {t("login.logout")}
          </button>
        </form>
      </>
    );
  });
}
