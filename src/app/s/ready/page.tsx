import { Suspense } from "react";
import { t } from "@/i18n";
import { currentStudent } from "../../_lib/auth";
import { LoggedOutNotice, guardPage } from "../../_lib/page-guard";
import { Loading } from "../../_lib/student-pages";
import { ReadyCheckScreen } from "./ReadyCheckScreen";

// The Ready check: 6 quick whole-number questions, once, before the first skill. Not a skill: it never changes
// mastery and never blocks a child. No AI tutor slot, for any class.

export default function ReadyPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-extrabold">{t("ready.title")}</h1>
      <Suspense fallback={<Loading />}>
        <Ready />
      </Suspense>
    </div>
  );
}

function Ready() {
  return guardPage("student", async () => {
    if (!(await currentStudent())) return <LoggedOutNotice />;
    return <ReadyCheckScreen />;
  });
}
