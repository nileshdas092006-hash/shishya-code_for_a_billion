import { Suspense } from "react";
import { t } from "@/i18n";
import { LoggedOutNotice, guardPage } from "../../../_lib/page-guard";
import { LockedNotice, Loading, SkillHeading, studentSkill } from "../../../_lib/student-pages";
import { TeachScreen } from "./TeachScreen";

export default function TeachPage({ params }: PageProps<"/s/teach/[skill]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Teach params={params} />
    </Suspense>
  );
}

function Teach({ params }: { params: Promise<{ skill: string }> }) {
  return guardPage("student", async () => {
    const { skill } = await params;
    const page = await studentSkill(skill);
    if (!page) return <LoggedOutNotice />;
    const { skillId, state } = page;
    if (state === "LOCKED") return <LockedNotice />;
    return (
      <div className="flex flex-col gap-6">
        <SkillHeading skillId={skillId} title={t("teach.title")} />
        <TeachScreen skillId={skillId} />
      </div>
    );
  });
}
