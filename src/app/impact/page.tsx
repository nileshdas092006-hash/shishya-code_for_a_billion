import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { t } from "@/i18n";
import type { Average, Impact, PairedResult } from "@/server/impact";
import { getServices } from "@/server/instance";
import { guardPage } from "../_lib/page-guard";
import { Loading } from "../_lib/student-pages";

// /impact: the Shishya Challenge's public numbers (F11), worked out at request time by the pure, tested
// computeImpact from REAL challenge classes only. No student data: no codes, no names, no single student's
// result (any average over fewer than 5 students is not shown). The same numbers are at /api/impact as JSON.

export default function ImpactPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ImpactNumbers />
    </Suspense>
  );
}

/** A number as shown: the real minus sign. */
const num = (x: number) => String(x).replace("-", "−");

function when(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { date, time };
}

function Paired({ result }: { result: PairedResult }) {
  if (!result.shown) return <p className="text-gray-700">{t("impact.notShown")}</p>;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-lg font-semibold">{t("impact.scores.line", { before: num(result.before), after: num(result.after) })}</p>
      <p>{t("impact.scores.change", { difference: num(result.difference), lo: num(result.ci95[0]), hi: num(result.ci95[1]), n: result.n })}</p>
    </div>
  );
}

function Rating({ label, rating }: { label: string; rating: Average }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold">{label}</span>
      <span>
        {rating.n === 0 ? t("impact.ratings.none") : rating.shown ? t("impact.ratings.value", { average: num(rating.average), n: rating.n }) : t("impact.notShown")}
      </span>
    </div>
  );
}

function ImpactNumbers() {
  return guardPage("student", async () => {
    await connection(); // always at request time: the numbers change as students take part
    const impact: Impact = await (await getServices()).impact();
    const { date, time } = when(impact.generatedAt);
    const diff = impact.scores.byGroup.difference;
    return (
      <article className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-extrabold">{t("impact.title")}</h1>
          <p className="text-base text-gray-700">{t("impact.generated", { date, time })}</p>
          <p role="note" className="msg-note text-lg font-semibold">
            {t("impact.honesty")}
          </p>
          <p className="text-base text-gray-700">{t("impact.scope")}</p>
        </header>

        <section className="flex flex-col gap-3" aria-labelledby="reached">
          <h2 id="reached" className="text-2xl font-bold">
            {t("impact.reached.title")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-lg">
              <thead>
                <tr className="border-b-2 border-gray-400 text-left">
                  <th className="py-2 pr-3" />
                  <th className="py-2 pr-3">{t("impact.reached.joined")}</th>
                  <th className="py-2 pr-3">{t("impact.reached.before")}</th>
                  <th className="py-2">{t("impact.reached.both")}</th>
                </tr>
              </thead>
              <tbody>
                {impact.reached.byClassLevel.map((l) => (
                  <tr key={l.level} className="border-b border-gray-300">
                    <td className="py-2 pr-3 font-semibold whitespace-nowrap">{t("impact.level", { level: l.level })}</td>
                    <td className="py-2 pr-3">{l.joined}</td>
                    <td className="py-2 pr-3">{l.finishedBefore}</td>
                    <td className="py-2">{l.finishedBoth}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-2 pr-3">{t("impact.all")}</td>
                  <td className="py-2 pr-3">{impact.reached.joined}</td>
                  <td className="py-2 pr-3">{impact.reached.finishedBefore}</td>
                  <td className="py-2">{impact.reached.finishedBoth}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="scores">
          <h2 id="scores" className="text-2xl font-bold">
            {t("impact.scores.title")}
          </h2>
          <Paired result={impact.scores.all} />
          <h3 className="text-xl font-bold">{t("impact.byLevel.title")}</h3>
          <ul className="flex flex-col gap-3">
            {impact.scores.byClassLevel.map((l) => (
              <li key={l.level} className="flex flex-col gap-1">
                <span className="font-bold">{t("impact.level", { level: l.level })}</span>
                <Paired result={l.result} />
              </li>
            ))}
          </ul>
          <h3 className="text-xl font-bold">{t("impact.byGroup.title")}</h3>
          <ul className="flex flex-col gap-3">
            <li className="flex flex-col gap-1">
              <span className="font-bold">{t("impact.groupA")}</span>
              <Paired result={impact.scores.byGroup.A} />
            </li>
            <li className="flex flex-col gap-1">
              <span className="font-bold">{t("impact.groupB")}</span>
              <Paired result={impact.scores.byGroup.B} />
            </li>
          </ul>
          <div className="flex flex-col gap-1">
            <span className="font-bold">{t("impact.groupDiff.label")}</span>
            {diff.shown ? (
              <p className="text-lg">{t("impact.groupDiff", { difference: num(diff.difference), lo: num(diff.ci95[0]), hi: num(diff.ci95[1]), nA: diff.nA, nB: diff.nB })}</p>
            ) : (
              <p className="text-gray-700">{t("impact.notShown")}</p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="delayed">
          <h2 id="delayed" className="text-2xl font-bold">
            {t("impact.delayed.title")}
          </h2>
          {impact.delayed.n === 0 ? (
            <p className="text-gray-700">{t("impact.delayed.none")}</p>
          ) : impact.delayed.shown ? (
            <p className="text-lg">{t("impact.delayed.value", { average: num(impact.delayed.average), n: impact.delayed.n })}</p>
          ) : (
            <p className="text-gray-700">{t("impact.notShown")}</p>
          )}
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="mistakes">
          <h2 id="mistakes" className="text-2xl font-bold">
            {t("impact.mistakes.title")}
          </h2>
          {impact.mistakes.share === null ? (
            <p className="text-gray-700">{t("impact.mistakes.none")}</p>
          ) : (
            <>
              <p className="text-lg">
                {t("impact.mistakes.share", { explained: impact.mistakes.explained, total: impact.mistakes.wrongAnswers, percent: Math.round(impact.mistakes.share * 100) })}
              </p>
              {impact.mistakes.top.length > 0 && (
                <>
                  <p className="font-semibold">{t("impact.mistakes.top")}</p>
                  <ol className="list-decimal pl-6">
                    {impact.mistakes.top.map((m) => (
                      <li key={m.label}>{t("impact.mistakes.item", { label: m.label, n: m.count })}</li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )}
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="miner">
          <h2 id="miner" className="text-2xl font-bold">
            {t("impact.miner.title")}
          </h2>
          {impact.miner.count === 0 ? (
            <p className="text-gray-700">{t("impact.miner.none")}</p>
          ) : (
            <>
              <p>{t("impact.miner.count", { n: impact.miner.count })}</p>
              <ul className="list-disc pl-6">
                {impact.miner.mistakes.map((m) => (
                  <li key={m.label}>{t("impact.miner.item", { label: m.label, n: m.realWrongAnswers })}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="ratings">
          <h2 id="ratings" className="text-2xl font-bold">
            {t("impact.ratings.title")}
          </h2>
          <Rating label={t("impact.ratings.useful")} rating={impact.ratings.useful} />
          <Rating label={t("impact.ratings.teach")} rating={impact.ratings.teachHelped} />
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="quotes">
          <h2 id="quotes" className="text-2xl font-bold">
            {t("impact.quotes.title")}
          </h2>
          {impact.quotes.length === 0 ? (
            <p className="text-gray-700">{t("impact.quotes.none")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {impact.quotes.map((q, i) => (
                <li key={i}>
                  <blockquote className="border-l-4 border-blue-800 pl-3 text-lg break-words">“{q.text}”</blockquote>
                  {q.classLevel !== null && <p className="pl-4 text-base text-gray-700">— {t("impact.quotes.level", { level: q.classLevel })}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="flex flex-col gap-2 border-t-2 border-gray-300 pt-4">
          <p className="text-base text-gray-700">{t("impact.method")}</p>
          <p className="text-base">
            {t("impact.json")}{" "}
            <Link href="/api/impact" className="underline break-all">
              /api/impact
            </Link>
          </p>
        </footer>
      </article>
    );
  });
}
