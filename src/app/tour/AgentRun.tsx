import { t, type MessageKey } from "@/i18n";
import { getServices } from "@/server/instance";
import { Equation } from "../_components/Equation";
import { recordedRun, type RecordedRun } from "./agent-run";
import { TourApprove } from "./TourApprove";

// Stop 6: how the Misconception Miner found a new mistake, from ONE recorded real run (never a live AI call),
// read from the run history (its row is marked recorded).

export async function AgentRun() {
  const row = await (await getServices()).recordedMinerRun();
  return <AgentRunView run={recordedRun(row)} />;
}

export function AgentRunView({ run }: { run: RecordedRun }) {
  const ex = run.example;
  const checked = run.validation.checkedQuestions.toLocaleString("en-IN");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold">{t("tour.agent.title")}</h1>
        <p className="font-bold text-amber-900">{run.label}</p>
      </div>

      <section className="card flex flex-col gap-2">
        <p>{t("tour.agent.input")}</p>
        <p>{t("tour.agent.example", { question: ex.question, answer: ex.recordedWrongAnswer })}</p>
        <p>{t("tour.agent.others", { list: run.otherWrongAnswers.map((a) => a.replace(/-/g, "−")).join(", ") })}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">{t("tour.agent.did")}</h2>
        <ol className="flex flex-col gap-1 list-decimal pl-6">
          {run.calls.map((c) => (
            <li key={c.at}>{t(`tour.agent.tool.${c.tool}` as MessageKey)}</li>
          ))}
        </ol>
        <p className="text-gray-700">{t("tour.agent.calls", { n: run.calls.length, seconds: run.seconds, model: run.model })}</p>
      </section>

      <section className="card flex flex-col gap-3">
        <p className="text-xl font-bold">{t("tour.agent.proposal", { formula: run.proposal.answerFormula.replace(/-/g, "−") })}</p>
        <p>{t("tour.agent.trace", { correct: ex.correct })}</p>
        <ol className="flex flex-col gap-1">
          {ex.trace.map((line, i) => (
            <li key={i} className={`flex items-baseline gap-3 ${i + 1 === ex.firstWrongLine ? "text-red-800" : ""}`}>
              <span className="shrink-0 font-semibold">L{i + 1}</span>
              <span className="flex-1 min-w-0">
                <Equation text={line} size="sm" />
                {i + 1 === ex.firstWrongLine && <span className="block text-base font-bold">{t("tour.agent.firstWrong")}</span>}
              </span>
            </li>
          ))}
        </ol>
        <p className="msg-good">{t("tour.agent.checks", { explained: run.validation.explained, checked: run.validation.checkedQuestions })}</p>
        <p className="msg-bad">{t("tour.agent.advice", { quote: run.proposal.childLabelExcerpt })}</p>
        <p className="msg-good">{t("tour.agent.since", { message: run.childNow })}</p>

        <h2 className="text-xl font-bold">{t("tour.agent.checkedNow")}</h2>
        <ul className="flex flex-col gap-1">
          {run.checkedNow.map((c) => (
            <li key={c.id} className={`flex gap-2 ${c.ok ? "text-green-800" : "text-red-800"}`}>
              <span aria-hidden="true" className="font-bold">
                {c.ok ? "✓" : "✗"}
              </span>
              <span>{t(`review.check.${c.id}`, { n: c.n.toLocaleString("en-IN") })}</span>
            </li>
          ))}
        </ul>
        <p className="text-base text-gray-700">{t("tour.agent.checkedNowNote", { explained: run.validation.explained, n: checked })}</p>
        <h3 className="text-lg font-bold">{t("review.evidence.title")}</h3>
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
              {run.evidence.map((e, i) => (
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
        <p className="font-semibold">{t("tour.agent.why")}</p>
        <TourApprove />
      </section>
    </div>
  );
}
