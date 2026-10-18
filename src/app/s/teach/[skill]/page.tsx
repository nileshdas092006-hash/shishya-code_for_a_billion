import { Suspense } from "react";
import { t } from "@/i18n";
import { LockedNotice, Loading, SkillHeading, studentSkill } from "../../../_lib/student-pages";
import { TeachScreen } from "./TeachScreen";

export default function TeachPage({ params }: PageProps<"/s/teach/[skill]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Teach params={params} />
    </Suspense>
  );
}

async function Teach({ params }: { params: Promise<{ skill: string }> }) {
  const { skill } = await params;
  const { skillId, state } = await studentSkill(skill);
  if (state === "LOCKED") return <LockedNotice />;
  return (
    <div className="flex flex-col gap-6">
      <SkillHeading skillId={skillId} title={t("teach.title")} />
      <TeachScreen skillId={skillId} />
    </div>
  );
}
