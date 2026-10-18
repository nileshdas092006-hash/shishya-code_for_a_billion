import { Suspense } from "react";
import { t } from "@/i18n";
import { LockedNotice, Loading, SkillHeading, studentSkill } from "../../../_lib/student-pages";
import { AiTutorSlot } from "../../../_components/AiTutorSlot";
import { PractiseScreen } from "./PractiseScreen";

export default function PractisePage({ params }: PageProps<"/s/practise/[skill]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Practise params={params} />
    </Suspense>
  );
}

async function Practise({ params }: { params: Promise<{ skill: string }> }) {
  const { skill } = await params;
  const { skillId, state, aiChat } = await studentSkill(skill);
  if (state === "LOCKED") return <LockedNotice />;
  return (
    <div className="flex flex-col gap-6">
      <SkillHeading skillId={skillId} title={t("practise.title")} />
      <PractiseScreen skillId={skillId} />
      <AiTutorSlot allowed={aiChat} />

    </div>
  );
}
