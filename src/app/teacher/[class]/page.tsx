import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getServices } from "@/server/instance";
import { ClassBoardView } from "./ClassBoardView";
import { teacherClass } from "../../_lib/auth";
import { guardPage } from "../../_lib/page-guard";
import { TeacherPinForm } from "../TeacherPinForm";

// The teacher's class board. Needs the class PIN (once per browser). Shows student CODES only, never names.

export default function ClassBoardPage({ params, searchParams }: PageProps<"/teacher/[class]">) {
  return (
    <Suspense fallback={<p className="text-xl">…</p>}>
      <ClassBoard params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Query = Promise<Record<string, string | string[] | undefined>>;

function ClassBoard({ params, searchParams }: { params: Promise<{ class: string }>; searchParams: Query }) {
  return guardPage("teacher", async () => {
    const classCode = decodeURIComponent((await params).class).toUpperCase();
    await connection();
    const svc = await getServices();
    const cls = await teacherClass(classCode); // the class is read once; a second read only when there is no PIN cookie
    if (!cls) {
      if (!(await svc.getClassByCode(classCode))) notFound();
      return (
        <section className="card flex flex-col gap-4">
          <h1 className="text-2xl font-bold">Class {classCode}: enter the teacher PIN</h1>
          <TeacherPinForm classCode={classCode} />
        </section>
      );
    }

    return <ClassBoardView cls={cls} query={await searchParams} />;
  });
}
