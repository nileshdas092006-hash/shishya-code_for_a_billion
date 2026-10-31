import { Suspense } from "react";
import { t } from "@/i18n";
import { getServices } from "@/server/instance";
import { currentStudent } from "../../_lib/auth";
import { guardPage, LoggedOutNotice } from "../../_lib/page-guard";
import { BackHome, Loading } from "../../_lib/student-pages";
import { ChallengeScreen } from "./ChallengeScreen";

// The Shishya Challenge (F11), for a student who joined with the challenge link: 1 Before · 2 Practise · 3 After ·
// 4 Feedback. The first step is worked out here on the server, so a new student sees their code (to write down)
// before the page is ready. No AI tutor slot, for any student.

export default function ChallengePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Challenge />
    </Suspense>
  );
}

function Challenge() {
  return guardPage("student", async () => {
    const student = await currentStudent();
    if (!student) return <LoggedOutNotice />;
    const overview = student.classMode === "challenge" ? await (await getServices()).challengeOverview(student.studentId) : null;
    if (!overview || !overview.ok) {
      return (
        <div className="flex flex-col gap-4">
          <p className="msg-note text-xl">{t("challenge.only")}</p>
          <BackHome />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-6">
        <p className="text-xl font-bold text-gray-700 break-words">{overview.title}</p>
        <ChallengeScreen initial={overview} />
      </div>
    );
  });
}
