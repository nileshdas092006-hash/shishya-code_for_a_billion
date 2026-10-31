import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/i18n";
import { currentStudent } from "../../_lib/auth";
import { guardPage, LoggedOutNotice } from "../../_lib/page-guard";
import { BackHome, Loading } from "../../_lib/student-pages";
import { CodeCard } from "./CodeCard";

// The Shishya Challenge (F11), for a student who joined with the challenge link. First the student's code, big,
// to write down (it is the only way back in), with the class code.

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
    if (student.classMode !== "challenge") {
      return (
        <div className="flex flex-col gap-4">
          <p className="msg-note text-xl">{t("challenge.only")}</p>
          <BackHome />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-extrabold break-words">{student.challengeTitle}</h1>
        <CodeCard code={student.code} classCode={student.classCode} />
        <Link href="/s/home" className="btn btn-primary self-start text-2xl">
          {t("challenge.start")}
        </Link>
      </div>
    );
  });
}
