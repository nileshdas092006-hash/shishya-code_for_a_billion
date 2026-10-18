import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { skillKey, t } from "@/i18n";
import { getServices } from "@/server/instance";
import { logoutStudent } from "../../actions";
import { currentStudent } from "../../_lib/auth";
import { Loading } from "../../_lib/student-pages";
import { StateIcon } from "../../_components/StateIcon";

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

async function SkillMap() {
  const student = await currentStudent();
  if (!student) redirect("/s");
  const skills = await (await getServices()).getSkillMap(student.studentId);
  return (
    <>
      <p className="text-lg text-gray-700">{student.code}</p>
      <ol className="flex flex-col gap-4">
        {skills.map(({ skillId, state }) => {
          const path = encodeURIComponent(skillId);
          return (
            <li key={skillId} className="card flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <StateIcon state={state} />
                <div className="flex flex-col">
                  <span className="text-2xl font-bold">{t(skillKey(skillId, "title"))}</span>
                  <span className="math text-lg text-gray-700">{t(skillKey(skillId, "example"))}</span>
                </div>
                <span className="ml-auto text-lg font-bold">{t(`map.state.${state}`)}</span>
              </div>
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
}
