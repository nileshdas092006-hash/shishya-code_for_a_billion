import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { t } from "@/i18n";
import { getServices } from "@/server/instance";
import { deleteClassAction } from "../../../actions";
import { teacherClass } from "../../../_lib/auth";
import { guardPage } from "../../../_lib/page-guard";
import { TeacherPinForm } from "../../TeacherPinForm";

// "Delete this class and all its data": the teacher types the class code to confirm. A plain server-action form,
// so it works before the page is ready. A tour class is deleted by itself after 24 hours, so it has no button.

export default function DeleteClassPage({ params, searchParams }: PageProps<"/teacher/[class]/delete">) {
  return (
    <Suspense fallback={<p className="text-xl">…</p>}>
      <DeleteClass params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Query = Promise<Record<string, string | string[] | undefined>>;

function DeleteClass({ params, searchParams }: { params: Promise<{ class: string }>; searchParams: Query }) {
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
    if (cls.kind === "sandbox") notFound();
    const wrong = (await searchParams).wrong === "1";
    return (
      <section className="card flex flex-col gap-4 border-red-800">
        <h1 className="text-2xl font-bold">{t("delete.title", { code: cls.code })}</h1>
        <p className="text-lg">{t("delete.explain")}</p>
        <p>
          <a href={`${base}/export`} className="underline" download>
            {t("delete.keep")}
          </a>
        </p>
        {wrong && (
          <p role="alert" className="msg-bad">
            {t("delete.wrong")}
          </p>
        )}
        <form action={deleteClassAction.bind(null, cls.code)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 font-semibold">
            {t("delete.type", { code: cls.code })}
            <input name="confirmCode" required autoComplete="off" autoCapitalize="characters" className="field uppercase max-w-xs" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary bg-red-800 border-red-800">
              {t("delete.yes")}
            </button>
            <Link href={base} className="btn">
              {t("delete.cancel")}
            </Link>
          </div>
        </form>
      </section>
    );
  });
}
