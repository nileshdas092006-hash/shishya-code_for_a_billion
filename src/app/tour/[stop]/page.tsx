import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { skillKey, t } from "@/i18n";
import { getServices } from "@/server/instance";
import { TOUR_SKILL, TOUR_STOPS } from "@/server/tour";
import { Equation } from "../../_components/Equation";
import { Receipt } from "../../_components/Receipt";
import { currentStudent, teacherClass } from "../../_lib/auth";
import { guardPage } from "../../_lib/page-guard";
import { Loading, SkillHeading } from "../../_lib/student-pages";
import { SkillCardHeader } from "../../s/home/SkillCardHeader";
import { PractiseScreen } from "../../s/practise/[skill]/PractiseScreen";
import { ProveScreen } from "../../s/prove/[skill]/ProveScreen";
import { TeachScreen } from "../../s/teach/[skill]/TeachScreen";
import { ClassBoardView } from "../../teacher/[class]/ClassBoardView";
import { AgentRun } from "../AgentRun";
import { SkipAheadForm } from "../SkipAheadForm";
import { StartTourForm } from "../StartTourForm";
import { TourBanner } from "../TourBanner";

// The Judge Tour: six stops, each the REAL screen and the real server code, on the tour's made-up class
// (a sandbox class, deleted after 24 hours). Stops 1–4 are the child's side, 5 the teacher's, 6 the AI agent.

export default function TourStopPage({ params }: PageProps<"/tour/[stop]">) {
  return (
    <Suspense fallback={<Loading />}>
      <TourStop params={params} />
    </Suspense>
  );
}

function TourStop({ params }: { params: Promise<{ stop: string }> }) {
  return guardPage("student", async () => {
    const stop = Number((await params).stop);
    if (!Number.isInteger(stop) || stop < 1 || stop > TOUR_STOPS) notFound();
    return (
      <div className="flex flex-col gap-6">
        <TourBanner stop={stop} />
        {stop === TOUR_STOPS ? <AgentRun /> : await stopContent(stop)}
      </div>
    );
  });
}

/** No tour child in this browser (never started, or the tour was deleted after 24 hours). */
function TourEnded() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="msg-note text-xl">{t("tour.ended")}</p>
      <StartTourForm />
    </div>
  );
}

async function stopContent(stop: number) {
  const student = await currentStudent();
  if (!student || student.classKind !== "sandbox") return <TourEnded />;
  const svc = await getServices();
  switch (stop) {
    case 1:
      return (
        <>
          <SkillHeading skillId={TOUR_SKILL} title={t("practise.title")} />
          <PractiseScreen skillId={TOUR_SKILL} answerKind="number" />
        </>
      );
    case 2:
      return (
        <>
          <SkillHeading skillId={TOUR_SKILL} title={t("teach.title")} />
          <TeachScreen skillId={TOUR_SKILL} />
        </>
      );
    case 3: {
      const [state, classmate] = await Promise.all([svc.getState(student.studentId, TOUR_SKILL), svc.tourClassmateProof(student.studentId)]);
      return (
        <>
          <SkillHeading skillId={TOUR_SKILL} title={t("prove.title")} />
          <p className="font-bold">{t("prove.noAiHelp")}</p>
          {state === "OPEN" ? (
            <div className="card flex flex-col items-start gap-4">
              <p className="text-lg">{t("tour.skip.explain")}</p>
              <SkipAheadForm />
            </div>
          ) : (
            <ProveScreen skillId={TOUR_SKILL} answerKind="number" />
          )}
          {classmate && (
            <aside className="card flex flex-col gap-3" aria-labelledby="classmate">
              <h2 id="classmate" className="text-xl font-bold">
                {t("tour.classmate.title")}
              </h2>
              <p>{t("tour.classmate.intro", { code: classmate.code })}</p>
              <ol className="flex flex-col gap-2 list-decimal pl-6">
                {classmate.questions.map((q, i) => (
                  <li key={i}>{q.format === "apply" ? <span>{q.text}</span> : <Equation text={q.text} size="sm" />}</li>
                ))}
              </ol>
            </aside>
          )}
        </>
      );
    }
    case 4: {
      const [skills, receipts] = await Promise.all([svc.getSkillMap(student.studentId), svc.lastProofReceipts(student.studentId, TOUR_SKILL)]);
      return (
        <>
          <h1 className="text-3xl font-extrabold">{t("map.title")}</h1>
          <ol className="flex flex-col gap-3">
            {skills.map(({ skillId, state }) => (
              <li key={skillId} className={`card ${skillId === TOUR_SKILL ? "border-green-800" : ""}`}>
                <SkillCardHeader skillId={skillId} state={state} cooldownHours={student.proofCooldownHours} />
              </li>
            ))}
          </ol>
          {receipts ? (
            <section aria-labelledby="receipts" className="flex flex-col gap-3">
              <h2 id="receipts" className="text-2xl font-bold">
                {t("prove.receipts")}
              </h2>
              <p className="text-gray-700">{t(skillKey(TOUR_SKILL, "title"))}</p>
              {receipts.map((r, i) => (
                <div key={r.itemId} className="flex flex-col gap-2">
                  <p className="text-xl font-semibold">{t("prove.question", { n: i + 1, total: receipts.length })}</p>
                  <Equation text={r.question} size="md" />
                  {r.receipt ? <Receipt receipt={r.receipt} /> : <p className="msg-note">{t("prove.notAnswered")}</p>}
                </div>
              ))}
            </section>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="msg-note text-xl">{t("tour.mastered.none")}</p>
              <Link href="/tour/3" className="btn btn-primary">
                {t("tour.stop.3")}
              </Link>
            </div>
          )}
        </>
      );
    }
    default: {
      const cls = await teacherClass(student.classCode);
      if (!cls || cls.kind !== "sandbox") return <TourEnded />;
      return <ClassBoardView cls={cls} query={{}} />;
    }
  }
}
