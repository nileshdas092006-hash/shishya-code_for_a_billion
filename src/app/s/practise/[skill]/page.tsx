import { Suspense } from "react";
import { getSkillEntry } from "@/core/skills";
import { t } from "@/i18n";
import { LoggedOutNotice, guardPage } from "../../../_lib/page-guard";
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

function Practise({ params }: { params: Promise<{ skill: string }> }) {
  return guardPage("student", async () => {
    const { skill } = await params;
    const page = await studentSkill(skill);
    if (!page) return <LoggedOutNotice />;
    const { skillId, state, aiChat } = page;
    if (state === "LOCKED") return <LockedNotice />;
    return (
      <div className="flex flex-col gap-6">
        <SkillHeading skillId={skillId} title={t("practise.title")} />
        <PractiseScreen skillId={skillId} answerKind={getSkillEntry(skillId)!.spec.answerKind} />
        <AiTutorSlot allowed={aiChat} />

      </div>
    );
  });
}
