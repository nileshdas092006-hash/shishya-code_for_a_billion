import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createRng } from "@/core/rng";
import { getSkillEntry } from "@/core/skills";
import { skillKey, t } from "@/i18n";
import { getServices } from "@/server/instance";
import { toMistake } from "@/core/minedMistake";
import { unlockSkillForClass } from "../../actions";
import { MinedDecision } from "./MinedDecision";
import { Equation } from "../../_components/Equation";
import { teacherClass } from "../../_lib/auth";
import { StudentCodeSheet } from "../CreateClassForm";
import { PrintButton } from "../PrintButton";
import { TeacherPinForm } from "../TeacherPinForm";

// The teacher's class board. Needs the class PIN (once per browser). Shows student CODES only, never names.

const EXAMPLE_SEED = 20261018;

export default function ClassBoardPage({ params }: PageProps<"/teacher/[class]">) {
  return (
    <Suspense fallback={<p className="text-xl">…</p>}>
      <ClassBoard params={params} />
    </Suspense>
  );
}

async function ClassBoard({ params }: { params: Promise<{ class: string }> }) {
  const classCode = decodeURIComponent((await params).class).toUpperCase();
  await connection();
  const svc = await getServices();
  if (!(await svc.getClassByCode(classCode))) notFound();
  const cls = await teacherClass(classCode);
  if (!cls) {
    return (
      <section className="card flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Class {classCode}: enter the teacher PIN</h1>
        <TeacherPinForm classCode={classCode} />
      </section>
    );
  }

  const stuck = await svc.getStuckBoard(cls.id);
  const progress = await svc.getClassProgress(cls.id);
  const mined = await svc.listPendingMinedMistakes();
  const codes = await svc.listStudentCodes(cls.id);
  const base = `/teacher/${encodeURIComponent(cls.code)}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <h1 className="text-3xl font-extrabold">
          Class {cls.grade}
          {cls.section} <span className="math text-2xl text-gray-700">({cls.code})</span>
        </h1>
        <div className="flex flex-wrap gap-3">
          <Link href={`${base}/project`} className="btn btn-primary">
            Projector mode
          </Link>
          <a href={`${base}/export`} className="btn" download>
            Download pilot CSV
          </a>
        </div>
      </div>
      {!cls.aiAllowed && <p className="msg-note no-print">Class 7: AI chat is switched off for this class, always.</p>}

      <section className="flex flex-col gap-3 no-print" aria-labelledby="stuck">
        <h2 id="stuck" className="text-2xl font-bold">
          Stuck board (last 7 days)
        </h2>
        {stuck.length === 0 ? (
          <p className="text-gray-700">No wrong answers yet.</p>
        ) : (
          stuck.map((g) => <StuckGroup key={`${g.skillId}|${g.mistakeId}`} group={g} />)
        )}
      </section>

      <section className="flex flex-col gap-3 no-print" aria-labelledby="progress">
        <h2 id="progress" className="text-2xl font-bold">
          Progress
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-lg">
            <thead>
              <tr className="border-b-2 border-gray-400 text-left">
                <th className="py-2 pr-3">Skill</th>
                <th className="py-2 pr-3">Locked</th>
                <th className="py-2 pr-3">Open</th>
                <th className="py-2 pr-3">Key 1</th>
                <th className="py-2 pr-3">Not yet</th>
                <th className="py-2 pr-3">Mastered</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {progress.map(({ skillId, counts }) => (
                <tr key={skillId} className="border-b border-gray-300">
                  <td className="py-2 pr-3 font-semibold">{t(skillKey(skillId, "title"))}</td>
                  <td className="py-2 pr-3">{counts.LOCKED}</td>
                  <td className="py-2 pr-3">{counts.OPEN}</td>
                  <td className="py-2 pr-3">{counts.KEY1}</td>
                  <td className="py-2 pr-3">{counts.NOT_YET}</td>
                  <td className="py-2 pr-3">{counts.MASTERED}</td>
                  <td className="py-2">
                    {counts.LOCKED > 0 && (
                      <form action={unlockSkillForClass.bind(null, cls.code, skillId)}>
                        <button type="submit" className="btn">
                          Unlock for class
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3 no-print" aria-labelledby="mined">
        <h2 id="mined" className="text-2xl font-bold">
          New mistakes found by the Misconception Miner
        </h2>
        {mined.length === 0 ? (
          <p className="text-gray-700">Nothing waiting for your decision.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {mined.map((m) => (
              <li key={m.id} className="card flex flex-col gap-3">
                <MinedDraft draft={m} />
                {m.spec ? (
                  <MinedDecision
                    classCode={cls.code}
                    draft={{ id: m.id, label: m.spec.label, childLabel: m.spec.childLabel, answerFormula: m.spec.answerFormula }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="no-print">
          <PrintButton label="Print student codes" />
        </div>
        <StudentCodeSheet classCode={cls.code} codes={codes} />
      </section>
    </div>
  );
}

type Draft = Awaited<ReturnType<Awaited<ReturnType<typeof getServices>>["listPendingMinedMistakes"]>>[number];

/** A tested draft from the Misconception Miner: what it says, how much data it explains, and an example. */
function MinedDraft({ draft }: { draft: Draft }) {
  const entry = getSkillEntry(draft.skillId);
  const spec = draft.spec;
  let example: { text: string }[] | null = null;
  let wrongLine = 0;
  try {
    if (entry && spec) {
      const out = toMistake(spec, entry.spec).apply(entry.spec.generate(createRng(EXAMPLE_SEED)));
      example = out.trace;
      wrongLine = out.firstWrongLine;
    }
  } catch {
    example = null;
  }
  if (!spec) return <p className="msg-bad">Draft {draft.id} could not be read. Reject it.</p>;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xl font-bold">Draft from the Misconception Miner: {spec.id}</h3>
      {draft.report && (
        <p>
          Explains {draft.report.reproduced} logged wrong answers · checked by code on {draft.report.checkedInstances} questions
        </p>
      )}
      {example && (
        <ol className="flex flex-col gap-1">
          {example.map((line, i) => (
            <li key={i} className={`flex items-baseline gap-3 ${i + 1 === wrongLine ? "text-red-800" : ""}`}>
              <span className="shrink-0 font-semibold">L{i + 1}</span>
              <span className="flex-1 min-w-0">
                <Equation text={line.text} size="sm" />
                {i + 1 === wrongLine && <span className="block text-base font-bold">← first wrong line</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-base text-gray-700">
        Drafted by the AI Misconception Miner and checked by code. It is used only after you approve it, and it never changes
        any child&apos;s mastery.
      </p>
    </div>
  );
}

type Group = Awaited<ReturnType<Awaited<ReturnType<typeof getServices>>["getStuckBoard"]>>[number];

function StuckGroup({ group }: { group: Group }) {
  const entry = getSkillEntry(group.skillId);
  const mistake = entry?.spec.mistakes.find((m) => m.id === group.mistakeId);
  const example = entry && mistake ? mistake.apply(entry.spec.generate(createRng(EXAMPLE_SEED))) : null;
  return (
    <article className="card flex flex-col gap-3">
      <h3 className="text-xl font-bold">
        {group.count} {group.count === 1 ? "student" : "students"}: {group.label}
      </h3>
      <p className="text-gray-700">
        <span className="math">{group.mistakeId}</span> · {t(skillKey(group.skillId, "title"))}
      </p>
      {example && (
        <div>
          <p className="font-semibold">Example of this mistake:</p>
          <ol className="flex flex-col gap-1">
            {example.trace.map((line, i) => (
              <li key={i} className={`flex items-baseline gap-3 ${i + 1 === example.firstWrongLine ? "text-red-800" : ""}`}>
                <span className="shrink-0 font-semibold">L{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <Equation text={line.text} size="sm" />
                  {i + 1 === example.firstWrongLine && <span className="block text-base font-bold">← first wrong line</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p>
        Codes: <span className="math">{group.studentCodes.join(", ")}</span>
      </p>
    </article>
  );
}
