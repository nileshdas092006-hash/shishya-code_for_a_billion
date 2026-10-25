import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { skillKey, t } from "@/i18n";
import { getServices } from "@/server/instance";
import { Equation } from "../../../../_components/Equation";
import { teacherClass } from "../../../../_lib/auth";
import { guardPage } from "../../../../_lib/page-guard";
import { PrintButton } from "../../../PrintButton";
import { TeacherPinForm } from "../../../TeacherPinForm";
import { PaperEntryForm } from "./PaperEntryForm";

// One paper worksheet: the printable sheet (the same questions for every child, from the seeds stored with it,
// with its code and a box for the child's CODE, never a name) and the grid where the teacher types in each
// child's final answer. Only the sheet is printed.

export default function WorksheetPage({ params }: PageProps<"/teacher/[class]/paper/[sheet]">) {
  return (
    <Suspense fallback={<p className="text-xl">…</p>}>
      <Worksheet params={params} />
    </Suspense>
  );
}

function Worksheet({ params }: { params: Promise<{ class: string; sheet: string }> }) {
  return guardPage("teacher", async () => {
    const p = await params;
    const classCode = decodeURIComponent(p.class).toUpperCase();
    const sheetCode = decodeURIComponent(p.sheet).toUpperCase();
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
    const ws = await svc.getWorksheet(cls.id, sheetCode);
    if (!ws) notFound();
    const base = `/teacher/${encodeURIComponent(cls.code)}`;
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-x-6 gap-y-2 no-print">
          <Link href={base} className="underline text-lg">
            {t("paper.back")}
          </Link>
          <Link href={`${base}/paper`} className="underline text-lg">
            {t("paper.toList")}
          </Link>
        </div>
        <div className="flex flex-col gap-3 no-print">
          <h1 className="text-3xl font-extrabold">{t("paper.sheet.title", { code: ws.code })}</h1>
          <p className="text-lg">{t("paper.sheet.same")}</p>
          <PrintButton label={t("paper.sheet.print")} />
        </div>

        {/* the printed sheet (also shown on screen, so the teacher sees what children get) */}
        <section className="card flex flex-col gap-4" aria-label={t("paper.print.code", { code: ws.code })}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <span className="text-xl font-bold">{t(skillKey(ws.skillId, "title"))}</span>
            <span className="math text-lg font-semibold">
              {t("paper.print.code", { code: ws.code })} · {t("paper.print.class", { cls: `${cls.grade}${cls.section}` })}
            </span>
          </div>
          <p className="text-lg">
            {t("paper.print.child")} <span className="inline-block w-40 max-w-full border-b-2 border-black align-bottom">&nbsp;</span>
          </p>
          <p className="text-lg">
            {t(skillKey(ws.skillId, "task"))} {t("paper.print.answer")}
          </p>
          <ol className="flex flex-col gap-4">
            {ws.questions.map((q) => (
              <li key={q.n} className="print-codes flex flex-col gap-2 border-b border-gray-300 pb-4">
                <span className="flex items-baseline gap-3">
                  <span className="shrink-0 font-bold">{q.n}.</span>
                  <span className="flex-1 min-w-0">
                    <Equation text={q.text} size="md" />
                  </span>
                </span>
                <span className="flex items-center gap-3 text-lg">
                  {t(skillKey(ws.skillId, "answerLabel"))}
                  <span className="inline-block h-10 w-48 max-w-[70%] border-2 border-black rounded" />
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-3 no-print" aria-labelledby="grid">
          <h2 id="grid" className="text-2xl font-bold">
            {t("paper.grid.title")}
          </h2>
          {ws.current ? (
            <>
              <p>{t("paper.grid.intro")}</p>
              <PaperEntryForm classCode={cls.code} sheetCode={ws.code} questions={ws.questions.map((q) => q.n)} grid={ws.grid} />
            </>
          ) : (
            <p className="msg-note">{t("paper.sheet.old")}</p>
          )}
        </section>
      </div>
    );
  });
}
