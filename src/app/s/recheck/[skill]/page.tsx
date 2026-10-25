import { Suspense } from "react";
import { getSkillEntry } from "@/core/skills";
import { t } from "@/i18n";
import { LoggedOutNotice, guardPage } from "../../../_lib/page-guard";
import { BackHome, Loading, SkillHeading, studentSkill } from "../../../_lib/student-pages";
import { RecheckScreen } from "./RecheckScreen";

// The 7-day quick check of a MASTERED skill: 2 fresh questions, no hints, 15 minutes. No AI tutor slot, for any
// class. Whatever the result, the skill stays Mastered (the server records it through mastery.ts).

export default function RecheckPage({ params }: PageProps<"/s/recheck/[skill]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Recheck params={params} />
    </Suspense>
  );
}

function Recheck({ params }: { params: Promise<{ skill: string }> }) {
  return guardPage("student", async () => {
    const { skill } = await params;
    const page = await studentSkill(skill);
    if (!page) return <LoggedOutNotice />;
    const { skillId, state } = page;
    return (
      <div className="flex flex-col gap-6">
        <SkillHeading skillId={skillId} title={t("recheck.title")} />
        {state === "MASTERED" ? (
          <RecheckScreen skillId={skillId} answerKind={getSkillEntry(skillId)!.spec.answerKind} />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="msg-note text-xl">{t("recheck.notDue")}</p>
            <BackHome />
          </div>
        )}
      </div>
    );
  });
}
