import Link from "next/link";
import { notFound } from "next/navigation";
import { getSkillEntry } from "@/core/skills";
import { skillKey, t } from "@/i18n";
import { getServices } from "@/server/instance";
import { aiFlagsFromEnv, canShowAiChat } from "@/server/policy";
import { currentStudent } from "./auth";

// Shared by the student skill pages: who is logged in, which skill, and its state.

/** null when no child is logged in (the page then shows LoggedOutNotice). */
export async function studentSkill(rawSkill: string) {
  const student = await currentStudent();
  if (!student) return null;
  const skillId = decodeURIComponent(rawSkill);
  if (!getSkillEntry(skillId)) notFound();
  const state = await (await getServices()).getState(student.studentId, skillId);
  return { student, skillId, state, aiChat: canShowAiChat(student, aiFlagsFromEnv()) };
}

export function SkillHeading({ skillId, title }: { skillId: string; title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="text-xl text-gray-700">
        {t(skillKey(skillId, "title"))} <span className="math">({t(skillKey(skillId, "example"))})</span>
      </p>
    </div>
  );
}

export function LockedNotice() {
  return (
    <div className="flex flex-col gap-4">
      <p className="msg-note text-xl">{t("common.locked")}</p>
      <BackHome />
    </div>
  );
}

export function BackHome() {
  return (
    <Link href="/s/home" className="btn self-start">
      {t("common.back")}
    </Link>
  );
}

export function Loading() {
  return <p className="text-xl text-gray-700">…</p>;
}
