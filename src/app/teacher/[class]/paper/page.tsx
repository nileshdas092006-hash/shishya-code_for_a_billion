import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SKILLS } from "@/core/skills";
import { skillKey, t } from "@/i18n";
import { getServices } from "@/server/instance";
import { PAPER_DEFAULT_QUESTIONS, PAPER_MAX_QUESTIONS } from "@/server/services";
import { createWorksheetAction } from "../../../actions";
import { teacherClass } from "../../../_lib/auth";
import { guardPage } from "../../../_lib/page-guard";
import { TeacherPinForm } from "../../TeacherPinForm";

// Paper Mode: a class with no computers. The teacher makes a worksheet (a skill and N questions), prints it, and
// later types in each child's final answer on the worksheet's own page. A plain server-action form, so it works
// before the page is ready.

export default function PaperPage({ params, searchParams }: PageProps<"/teacher/[class]/paper">) {
  return (
    <Suspense fallback={<p className="text-xl">…</p>}>
      <Paper params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Query = Promise<Record<string, string | string[] | undefined>>;

function Paper({ params, searchParams }: { params: Promise<{ class: string }>; searchParams: Query }) {
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
    const base = `/teacher/${encodeURIComponent(cls.code)}`;
    const sheets = await svc.listWorksheets(cls.id);
    const bad = (await searchParams).bad === "1";
    return (
      <div className="flex flex-col gap-6">
        <Link href={base} className="self-start underline text-lg">
          {t("paper.back")}
        </Link>
        <h1 className="text-3xl font-extrabold">{t("paper.title")}</h1>
        <p className="text-lg">{t("paper.intro")}</p>

        <section className="card flex flex-col gap-4" aria-labelledby="new-sheet">
          <h2 id="new-sheet" className="text-2xl font-bold">
            {t("paper.new")}
          </h2>
          {bad && (
            <p role="alert" className="msg-bad">
              {t("paper.bad")}
            </p>
          )}
          <form action={createWorksheetAction.bind(null, cls.code)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 font-semibold">
              {t("paper.skill")}
              <select name="skill" required className="field max-w-full">
                {SKILLS.map(({ spec }) => (
                  <option key={spec.id} value={spec.id}>
                    {t(skillKey(spec.id, "title"))}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              {t("paper.count")}
              <input
                name="count"
                type="number"
                min={1}
                max={PAPER_MAX_QUESTIONS}
                step={1}
                defaultValue={PAPER_DEFAULT_QUESTIONS}
                required
                inputMode="numeric"
                className="field w-28"
              />
            </label>
            <button type="submit" className="btn btn-primary self-start">
              {t("paper.make")}
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="sheets">
          <h2 id="sheets" className="text-2xl font-bold">
            {t("paper.list")}
          </h2>
          {sheets.length === 0 ? (
            <p className="text-gray-700">{t("paper.none")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sheets.map((w) => (
                <li key={w.id}>
                  <Link href={`${base}/paper/${encodeURIComponent(w.code)}`} className="underline text-lg break-words">
                    {t("paper.item", { code: w.code, skill: t(skillKey(w.skillId, "title")), n: w.seeds.length, date: w.createdAt.slice(0, 10) })}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  });
}
