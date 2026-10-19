import { Suspense } from "react";
import { getSkillEntry } from "@/core/skills";
import { t } from "@/i18n";
import { LoggedOutNotice, guardPage } from "../../../_lib/page-guard";
import { LockedNotice, Loading, SkillHeading, studentSkill } from "../../../_lib/student-pages";
import { ProveScreen } from "./ProveScreen";

// Prove it: AI is off. This page never renders the AI tutor slot, for any class.

export default function ProvePage({ params }: PageProps<"/s/prove/[skill]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Prove params={params} />
    </Suspense>
  );
}

function Prove({ params }: { params: Promise<{ skill: string }> }) {
  return guardPage("student", async () => {
    const { skill } = await params;
    const page = await studentSkill(skill);
    if (!page) return <LoggedOutNotice />;
    const { skillId, state } = page;
    if (state === "LOCKED") return <LockedNotice />;
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SkillHeading skillId={skillId} title={t("prove.title")} />
          <AiOffBadge />
        </div>
        <ProveScreen skillId={skillId} answerKind={getSkillEntry(skillId)!.spec.answerKind} />
      </div>
    );
  });
}

function AiOffBadge() {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border-4 border-gray-900 bg-gray-900 text-white px-4 py-2 text-xl font-extrabold">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2.5" fill="none" />
        <path d="M6 18L18 6" stroke="white" strokeWidth="2.5" />
      </svg>
      {t("prove.aiOff")}
    </p>
  );
}
