import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SKILLS } from "@/core/skills";
import { getServices } from "@/server/instance";
import { teacherClass } from "../../../_lib/auth";
import { TeacherPinForm } from "../../TeacherPinForm";
import { ProjectorScreen } from "./ProjectorScreen";

// Projector mode: the teacher leads the whole class in teaching the Shishya. No student accounts needed,
// and nothing here changes any child's mastery.

export default function ProjectorPage({ params }: PageProps<"/teacher/[class]/project">) {
  return (
    <Suspense fallback={<p className="text-xl">…</p>}>
      <Projector params={params} />
    </Suspense>
  );
}

async function Projector({ params }: { params: Promise<{ class: string }> }) {
  const classCode = decodeURIComponent((await params).class).toUpperCase();
  await connection();
  if (!(await (await getServices()).getClassByCode(classCode))) notFound();
  const cls = await teacherClass(classCode);
  if (!cls) {
    return (
      <section className="card flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Class {classCode}: enter the teacher PIN</h1>
        <TeacherPinForm classCode={classCode} />
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/teacher/${encodeURIComponent(cls.code)}`} className="btn self-start no-print">
        Back to the class board
      </Link>
      <ProjectorScreen classCode={cls.code} skillIds={SKILLS.map((s) => s.spec.id)} />
    </div>
  );
}
