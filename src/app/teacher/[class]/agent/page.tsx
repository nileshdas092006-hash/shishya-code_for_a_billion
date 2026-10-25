import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { skillKey, t } from "@/i18n";
import { getServices } from "@/server/instance";
import { teacherClass } from "../../../_lib/auth";
import { guardPage } from "../../../_lib/page-guard";
import { TeacherPinForm } from "../../TeacherPinForm";

// "How the agent worked": the last 10 runs of the AI Misconception Miner ("the mistake finder" on screen), from the run history in the database.
// Each proposal with the code's verdict in plain words. Anonymous: no child data (the agent never saw any).

export default function AgentRunsPage({ params }: PageProps<"/teacher/[class]/agent">) {
  return (
    <Suspense fallback={<p className="text-xl">…</p>}>
      <AgentRuns params={params} />
    </Suspense>
  );
}

/** "2026-10-19T04:32:13.876Z" → "2026-10-19 04:32 UTC" */
const when = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

function AgentRuns({ params }: { params: Promise<{ class: string }> }) {
  return guardPage("teacher", async () => {
    const classCode = decodeURIComponent((await params).class).toUpperCase();
    await connection();
    const svc = await getServices();
    const cls = await teacherClass(classCode);
    if (!cls) {
      if (!(await svc.getClassByCode(classCode))) notFound();
      return (
        <section className="card flex flex-col gap-4">
          <h1 className="text-2xl font-bold">Class {classCode}: enter the teacher PIN</h1>
          <TeacherPinForm classCode={classCode} />
        </section>
      );
    }
    const { runs } = await svc.listAgentRuns(cls.id);
    return (
      <div className="flex flex-col gap-5">
        <Link href={`/teacher/${encodeURIComponent(cls.code)}`} className="btn self-start">
          {t("agentRuns.back")}
        </Link>
        <h1 className="text-3xl font-extrabold">{t("agentRuns.title")}</h1>
        <p>{t("agentRuns.intro")}</p>
        {runs.length === 0 && <p className="text-gray-700">{t("agentRuns.none")}</p>}
        <ol className="flex flex-col gap-4">
          {runs.map((run) => (
            <li key={run.id} id={`run-${run.id}`} className="card flex flex-col gap-2 scroll-mt-4">
              <h2 className="text-xl font-bold">{when(run.startedAt)}</h2>
              {run.recorded && <p className="font-bold text-amber-900">{t("agentRuns.recorded")}</p>}
              <p className="font-semibold">{t(run.statusText.key, run.statusText.params)}</p>
              <p className="text-gray-700 break-words">
                {t("agentRuns.meta", {
                  skill: t(skillKey(run.skillId, "title")),
                  turns: run.turns,
                  model: run.model ? `${run.provider} · ${run.model}` : t("agentRuns.noModel"),
                })}
              </p>
              {run.attempts.length === 0 ? (
                <p className="text-gray-700">{t("agentRuns.noProposals")}</p>
              ) : (
                <>
                  <p>{t("agentRuns.proposals")}</p>
                  <ol className="flex flex-col gap-2 list-decimal pl-6">
                    {run.attempts.map((a, i) => (
                      <li key={i} className="break-words">
                        <span className="math font-bold">x = {a.answerFormula.replace(/-/g, "−")}</span>
                        <span className={`block font-semibold ${a.ok ? "text-green-800" : "text-red-800"}`}>
                          {t(a.verdict.key, a.verdict.params)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  });
}
