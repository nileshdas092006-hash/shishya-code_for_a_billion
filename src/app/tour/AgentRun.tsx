import { t, type MessageKey } from "@/i18n";
import { getServices } from "@/server/instance";
import { Equation } from "../_components/Equation";
import { recordedRun } from "./agent-run";
import { TourApprove } from "./TourApprove";

// Stop 6: how the Misconception Miner found a new mistake, from ONE recorded real run (never a live AI call),
// read from the run history (its row is marked recorded).

export async function AgentRun() {
  const row = await (await getServices()).recordedMinerRun();
  const run = recordedRun(row);
  const ex = run.example;
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
            <li key={c.at}>
              {t(`tour.agent.tool.${c.tool}` as MessageKey)} <span className="text-gray-700 math">({c.tool})</span>
            </li>
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
        <p className="font-semibold">{t("tour.agent.why")}</p>
        <TourApprove />
      </section>
    </div>
  );
}
