import Link from "next/link";
import { createRng } from "@/core/rng";
import { getSkillEntry } from "@/core/skills";
import { toMistake } from "@/core/minedMistake";
import { skillKey, t } from "@/i18n";
import { getServices } from "@/server/instance";
import { COOLDOWN_CHOICES } from "@/server/services";
import type { ClassRow } from "@/server/store";
import { closeProofs, giveNewCodes, openProofs, recordConsentAction, setCooldownAction, unlockSkillForClass } from "../../actions";
import { MinedDecision } from "./MinedDecision";
import { PatternGrid, SlipList } from "./PatternGrid";
import { Equation } from "../../_components/Equation";
import { StudentCodeSheet } from "../CreateClassForm";
import { PrintButton } from "../PrintButton";

// The teacher's class board itself (the page checks the PIN first). Also shown, unchanged, as stop 5 of the Judge
// Tour for the tour's made-up class. Shows student CODES only, never names.

const EXAMPLE_SEED = 20261018;

type Query = Record<string, string | string[] | undefined>;

export async function ClassBoardView({ cls, query }: { cls: ClassRow; query: Query }) {
  const { stuck, progress, mined, codes, proofWindow, proofCooldown } = await (await getServices()).getClassBoard(cls.id);
  const base = `/teacher/${encodeURIComponent(cls.code)}`;
  const tour = cls.kind === "sandbox";

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
      <p className="text-base text-gray-700 no-print">{t("board.export.impact")}</p>
      {!cls.aiAllowed && <p className="msg-note no-print">Class 7: AI chat is switched off for this class, always.</p>}

      {!cls.consentRecordedAt && <ConsentForm classCode={cls.code} showCheck={query.consent === "check"} />}

      <ProofWindow classCode={cls.code} proof={proofWindow} />
      {!tour && <Cooldown classCode={cls.code} cooldown={proofCooldown} />}

      <section className="flex flex-col gap-3 no-print" aria-labelledby="stuck">
        <h2 id="stuck" className="text-2xl font-bold">
          Stuck board (last 7 days)
        </h2>
        {stuck.groups.length === 0 && stuck.slips.length === 0 ? (
          <p className="text-gray-700">No wrong answers yet.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-bold">{t("board.grid.title")}</h3>
              <p className="text-gray-700">{t("board.grid.intro")}</p>
              <PatternGrid grid={stuck.grid} />
            </div>
            {!stuck.groups.some((g) => g.mistakeId !== "unknown") && <p className="text-gray-700">{t("board.patterns.none")}</p>}
            {stuck.groups.map((g) => (
              <StuckGroup key={`${g.skillId}|${g.mistakeId}`} group={g} />
            ))}
            {stuck.slips.length > 0 && <SlipList slips={stuck.slips} />}
          </>
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
                <th className="py-2 pr-3">{t("board.goneAhead.head")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {progress.map(({ skillId, counts, goneAhead }) => (
                <tr key={skillId} className="border-b border-gray-300">
                  <td className="py-2 pr-3 font-semibold">{t(skillKey(skillId, "title"))}</td>
                  <td className="py-2 pr-3">{counts.LOCKED}</td>
                  <td className="py-2 pr-3">{counts.OPEN}</td>
                  <td className="py-2 pr-3">{counts.KEY1}</td>
                  <td className="py-2 pr-3">{counts.NOT_YET}</td>
                  <td className="py-2 pr-3">{counts.MASTERED}</td>
                  <td className={`py-2 pr-3 ${goneAhead > 0 ? "font-bold text-amber-900" : ""}`}>{goneAhead}</td>
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
        <p className="text-base text-gray-700">{t("board.goneAhead.intro")}</p>
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
                <MinedDraft draft={m} agentHref={`${base}/agent${m.runId ? `#run-${m.runId}` : ""}`} />
                {m.spec && m.childText ? (
                  <MinedDecision
                    classCode={cls.code}
                    draft={{
                      id: m.id,
                      label: m.spec.label,
                      childText: m.childText,
                      aiChildLabel: m.spec.childLabel,
                      answerFormula: m.spec.answerFormula,
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {cls.kind !== "sandbox" && (
          <Link href={`${base}/agent`} className="self-start underline text-lg">
            {t("review.howAgent")}
          </Link>
        )}
      </section>

      <section id="codes" className="flex flex-col gap-3">
        {query.codes === "new" && (
          <p role="status" className="msg-good no-print">
            {t("board.codes.done")}
          </p>
        )}
        <div className="flex flex-wrap gap-3 no-print">
          <PrintButton label="Print student codes" />
          {query.confirm !== "codes" && (
            <Link href={`${base}?confirm=codes#codes`} className="btn">
              {t("board.codes.give")}
            </Link>
          )}
        </div>
        {query.confirm === "codes" && (
          <div className="card flex flex-col gap-3 border-amber-700 no-print">
            <p className="text-xl">{t("board.codes.confirm")}</p>
            <form action={giveNewCodes.bind(null, cls.code)} className="flex flex-wrap gap-3">
              <button type="submit" className="btn btn-primary">
                {t("board.codes.yes")}
              </button>
              <Link href={`${base}#codes`} className="btn">
                {t("board.codes.cancel")}
              </Link>
            </form>
          </div>
        )}
        <StudentCodeSheet classCode={cls.code} codes={codes} />
      </section>

      {!tour && (
        <section className="flex flex-col gap-3 no-print" aria-label={t("board.delete.link")}>
          {cls.consentRecordedAt && (
            <p className="text-base text-gray-700">
              {cls.consentSlips === null
                ? t("board.consent.doneOld", { date: cls.consentRecordedAt.slice(0, 10) })
                : t("board.consent.done", { date: cls.consentRecordedAt.slice(0, 10), n: cls.consentSlips })}
            </p>
          )}
          <Link href={`${base}/delete`} className="btn self-start text-red-800">
            {t("board.delete.link")}
          </Link>
        </section>
      )}
    </div>
  );
}

/** At the top of the board until it is saved: children of this class cannot log in before. */
function ConsentForm({ classCode, showCheck }: { classCode: string; showCheck: boolean }) {
  return (
    <section id="consent" className="card flex flex-col gap-3 border-amber-700 no-print" aria-labelledby="consent-title">
      <h2 id="consent-title" className="text-2xl font-bold">
        {t("board.consent.title")}
      </h2>
      <p className="font-semibold">{t("board.consent.needed")}</p>
      {showCheck && (
        <p role="alert" className="msg-bad">
          {t("board.consent.check")}
        </p>
      )}
      <form action={recordConsentAction.bind(null, classCode)} className="flex flex-col gap-4">
        <label className="flex items-start gap-3 text-lg">
          <input type="checkbox" name="allowed" required className="mt-1 h-6 w-6 shrink-0" />
          <span>{t("board.consent.allowed")}</span>
        </label>
        <label className="flex flex-wrap items-center gap-3 text-lg font-semibold">
          {t("board.consent.slips")}
          <input name="slips" type="number" min={0} max={999} step={1} required inputMode="numeric" className="field w-28" />
        </label>
        <button type="submit" className="btn btn-primary self-start">
          {t("board.consent.save")}
        </button>
      </form>
    </section>
  );
}

/** "After a missed proof, the next try opens": tomorrow, next period or straight away (per class). */
function Cooldown({ classCode, cooldown }: { classCode: string; cooldown: Board["proofCooldown"] }) {
  return (
    <section className="card flex flex-col gap-3 no-print" aria-labelledby="cooldown">
      <h2 id="cooldown" className="text-2xl font-bold">
        {t("board.cooldown.title")}
      </h2>
      <form key={cooldown.hours} action={setCooldownAction.bind(null, classCode)} className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-lg font-semibold">{t("board.cooldown.intro")}</legend>
          {COOLDOWN_CHOICES.map((h) => (
            <label key={h} className="flex items-center gap-3 text-lg">
              <input type="radio" name="hours" value={h} required defaultChecked={cooldown.hours === h} className="h-6 w-6 shrink-0" />
              {t(`board.cooldown.${h}`)}
            </label>
          ))}
        </fieldset>
        <button type="submit" className="btn self-start">
          {t("board.cooldown.save")}
        </button>
      </form>
      <p className="text-base text-gray-700">{t("board.cooldown.now", { h: cooldown.hours })}</p>
    </section>
  );
}

type Board = Awaited<ReturnType<Awaited<ReturnType<typeof getServices>>["getClassBoard"]>>;

/** Open or close the proof window (classes made before windows existed show a note instead). */
function ProofWindow({ classCode, proof }: { classCode: string; proof: Board["proofWindow"] }) {
  return (
    <section className="card flex flex-col gap-3 no-print" aria-labelledby="proofs">
      <h2 id="proofs" className="text-2xl font-bold">
        {t("board.proofs.title")}
      </h2>
      {!proof.required ? (
        <p>{t("board.proofs.always")}</p>
      ) : (
        <>
          <p className={`text-xl font-semibold ${proof.minutesLeft > 0 ? "text-green-800" : ""}`}>
            {proof.minutesLeft > 0 ? t("board.proofs.openFor", { min: proof.minutesLeft }) : t("board.proofs.closed")}
          </p>
          <div className="flex flex-wrap gap-3">
            <form action={openProofs.bind(null, classCode)}>
              <button type="submit" className="btn btn-primary">
                {t("board.proofs.open")}
              </button>
            </form>
            {proof.minutesLeft > 0 && (
              <form action={closeProofs.bind(null, classCode)}>
                <button type="submit" className="btn">
                  {t("board.proofs.close")}
                </button>
              </form>
            )}
          </div>
          <p className="text-base text-gray-700">{t("board.proofs.started")}</p>
        </>
      )}
    </section>
  );
}

type Draft = Awaited<ReturnType<Awaited<ReturnType<typeof getServices>>["listPendingMinedMistakes"]>>[number];

/**
 * A tested draft from the Misconception Miner: what it says, how much data it explains, an example, the evidence
 * (each logged wrong answer it explains) and the 4 code checks.
 */
function MinedDraft({ draft, agentHref }: { draft: Draft; agentHref: string }) {
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
      <h4 className="text-lg font-bold">{t("review.evidence.title")}</h4>
      {draft.evidence.length === 0 ? (
        <p className="text-gray-700">{t("review.evidence.none")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr className="border-b-2 border-gray-400 text-left">
                <th className="py-1 pr-3">{t("review.evidence.question")}</th>
                <th className="py-1 pr-3">{t("review.evidence.answer")}</th>
                <th className="py-1 pr-3">{t("review.evidence.predicted")}</th>
                <th className="py-1 pr-3">{t("review.evidence.match")}</th>
                <th className="py-1">{t("review.evidence.times")}</th>
              </tr>
            </thead>
            <tbody>
              {draft.evidence.map((e, i) => (
                <tr key={i} className="border-b border-gray-300">
                  <td className="py-1 pr-3 math whitespace-nowrap">{e.question}</td>
                  <td className="py-1 pr-3 math whitespace-nowrap">x = {e.wrongAnswer.replace(/-/g, "−")}</td>
                  <td className="py-1 pr-3 math whitespace-nowrap">x = {e.predicted}</td>
                  <td className="py-1 pr-3 font-bold text-green-800" aria-label="yes">
                    ✓
                  </td>
                  <td className="py-1">{e.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {draft.checks.length > 0 && (
        <>
          <h4 className="text-lg font-bold">{t("review.checks.title")}</h4>
          <ul className="flex flex-col gap-1">
            {draft.checks.map((c) => (
              <li key={c.id} className={`flex gap-2 ${c.ok ? "text-green-800" : "text-red-800"}`}>
                <span aria-hidden="true" className="font-bold">
                  {c.ok ? "✓" : "✗"}
                </span>
                <span>{t(`review.check.${c.id}`, { n: c.n.toLocaleString("en-IN") })}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href={agentHref} className="self-start underline">
        {t("review.howAgent")}
      </Link>
      <p className="text-base text-gray-700">
        Drafted by the AI Misconception Miner and checked by code. It is used only after you approve it, and it never changes
        any child&apos;s mastery.
      </p>
    </div>
  );
}

type Group = Awaited<ReturnType<Awaited<ReturnType<typeof getServices>>["getStuckBoard"]>>["groups"][number];

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
      <ul className="flex flex-col gap-1">
        {group.students.map((s) => (
          <li key={s.code}>
            <span className="math font-semibold">{s.code}</span>:{" "}
            {t(group.mistakeId === "unknown" ? "board.unknown.evidence" : "board.patterns.evidence", { n: s.questions })}
          </li>
        ))}
      </ul>
    </article>
  );
}
