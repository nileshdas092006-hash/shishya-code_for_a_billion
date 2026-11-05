import Link from "next/link";
import { t } from "@/i18n";
import type { Average, Impact, PairedResult } from "@/server/impact";

// What /impact shows, from the result of the pure computeImpact: the school block first, then the college pack's
// block (F12), each under its own heading. No student data: no codes, no names, no single student's result.

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

type Reached = { joined: number; finishedBefore: number; finishedBoth: number };

function ReachedSection({ id, reached, levels = [] }: { id: string; reached: Reached; levels?: (Reached & { level: number })[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <h3 id={id} className="text-2xl font-bold">
        {t("impact.reached.title")}
      </h3>
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
            {levels.map((l) => (
              <tr key={l.level} className="border-b border-gray-300">
                <td className="py-2 pr-3 font-semibold whitespace-nowrap">{t("impact.level", { level: l.level })}</td>
                <td className="py-2 pr-3">{l.joined}</td>
                <td className="py-2 pr-3">{l.finishedBefore}</td>
                <td className="py-2">{l.finishedBoth}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-2 pr-3">{t("impact.all")}</td>
              <td className="py-2 pr-3">{reached.joined}</td>
              <td className="py-2 pr-3">{reached.finishedBefore}</td>
              <td className="py-2">{reached.finishedBoth}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GroupScores({ byGroup }: { byGroup: Impact["scores"]["byGroup"] }) {
  const diff = byGroup.difference;
  return (
    <>
      <h4 className="text-xl font-bold">{t("impact.byGroup.title")}</h4>
      <ul className="flex flex-col gap-3">
        <li className="flex flex-col gap-1">
          <span className="font-bold">{t("impact.groupA")}</span>
          <Paired result={byGroup.A} />
        </li>
        <li className="flex flex-col gap-1">
          <span className="font-bold">{t("impact.groupB")}</span>
          <Paired result={byGroup.B} />
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
    </>
  );
}

function DelayedSection({ id, delayed }: { id: string; delayed: Impact["delayed"] }) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby={id}>
      <h3 id={id} className="text-2xl font-bold">
        {t("impact.delayed.title")}
      </h3>
      {delayed.n === 0 ? (
        <p className="text-gray-700">{t("impact.delayed.none")}</p>
      ) : delayed.shown ? (
        <p className="text-lg">{t("impact.delayed.value", { average: num(delayed.average), n: delayed.n })}</p>
      ) : (
        <p className="text-gray-700">{t("impact.notShown")}</p>
      )}
    </section>
  );
}

function MistakesSection({ id, mistakes }: { id: string; mistakes: Impact["mistakes"] }) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby={id}>
      <h3 id={id} className="text-2xl font-bold">
        {t("impact.mistakes.title")}
      </h3>
      {mistakes.share === null ? (
        <p className="text-gray-700">{t("impact.mistakes.none")}</p>
      ) : (
        <>
          <p className="text-lg">{t("impact.mistakes.share", { explained: mistakes.explained, total: mistakes.wrongAnswers, percent: Math.round(mistakes.share * 100) })}</p>
          {mistakes.top.length > 0 && (
            <>
              <p className="font-semibold">{t("impact.mistakes.top")}</p>
              <ol className="list-decimal pl-6">
                {mistakes.top.map((m) => (
                  <li key={m.label}>{t("impact.mistakes.item", { label: m.label, n: m.count })}</li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </section>
  );
}

function RatingsSection({ id, ratings }: { id: string; ratings: Impact["ratings"] }) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby={id}>
      <h3 id={id} className="text-2xl font-bold">
        {t("impact.ratings.title")}
      </h3>
      <Rating label={t("impact.ratings.useful")} rating={ratings.useful} />
      <Rating label={t("impact.ratings.teach")} rating={ratings.teachHelped} />
    </section>
  );
}

function QuotesSection({ id, quotes }: { id: string; quotes: { text: string; classLevel?: number | null }[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <h3 id={id} className="text-2xl font-bold">
        {t("impact.quotes.title")}
      </h3>
      {quotes.length === 0 ? (
        <p className="text-gray-700">{t("impact.quotes.none")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {quotes.map((q, i) => (
            <li key={i}>
              <blockquote className="border-l-4 border-blue-800 pl-3 text-lg break-words">“{q.text}”</blockquote>
              {typeof q.classLevel === "number" && <p className="pl-4 text-base text-gray-700">— {t("impact.quotes.level", { level: q.classLevel })}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ImpactView({ impact }: { impact: Impact }) {
  const { date, time } = when(impact.generatedAt);
  const { college } = impact;
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

      <section className="flex flex-col gap-8" aria-labelledby="school">
        <h2 id="school" className="border-b-4 border-blue-800 pb-1 text-3xl font-extrabold">
          {t("impact.school.heading")}
        </h2>
        <ReachedSection id="school-reached" reached={impact.reached} levels={impact.reached.byClassLevel} />
        <section className="flex flex-col gap-4" aria-labelledby="school-scores">
          <h3 id="school-scores" className="text-2xl font-bold">
            {t("impact.scores.title")}
          </h3>
          <Paired result={impact.scores.all} />
          <h4 className="text-xl font-bold">{t("impact.byLevel.title")}</h4>
          <ul className="flex flex-col gap-3">
            {impact.scores.byClassLevel.map((l) => (
              <li key={l.level} className="flex flex-col gap-1">
                <span className="font-bold">{t("impact.level", { level: l.level })}</span>
                <Paired result={l.result} />
              </li>
            ))}
          </ul>
          <GroupScores byGroup={impact.scores.byGroup} />
        </section>
        <DelayedSection id="school-delayed" delayed={impact.delayed} />
        <MistakesSection id="school-mistakes" mistakes={impact.mistakes} />
        <section className="flex flex-col gap-2" aria-labelledby="school-miner">
          <h3 id="school-miner" className="text-2xl font-bold">
            {t("impact.miner.title")}
          </h3>
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
        <RatingsSection id="school-ratings" ratings={impact.ratings} />
        <QuotesSection id="school-quotes" quotes={impact.quotes} />
      </section>

      <section className="flex flex-col gap-8" aria-labelledby="college">
        <div className="flex flex-col gap-2">
          <h2 id="college" className="border-b-4 border-blue-800 pb-1 text-3xl font-extrabold">
            {t("impact.college.heading")}
          </h2>
          <p className="text-lg">{t("impact.college.note")}</p>
        </div>
        <ReachedSection id="college-reached" reached={college.reached} />
        <section className="flex flex-col gap-4" aria-labelledby="college-scores">
          <h3 id="college-scores" className="text-2xl font-bold">
            {t("impact.scores.title")}
          </h3>
          <Paired result={college.scores.all} />
          <GroupScores byGroup={college.scores.byGroup} />
        </section>
        <DelayedSection id="college-delayed" delayed={college.delayed} />
        <MistakesSection id="college-mistakes" mistakes={college.mistakes} />
        <RatingsSection id="college-ratings" ratings={college.ratings} />
        <QuotesSection id="college-quotes" quotes={college.quotes} />
      </section>

      <footer className="flex flex-col gap-2 border-t-2 border-gray-300 pt-4">
        <p className="text-base text-gray-700">{t("impact.method")}</p>
        <p className="text-base text-gray-700">{t("impact.college.method")}</p>
        <p className="text-base">
          {t("impact.json")}{" "}
          <Link href="/api/impact" className="underline break-all">
            /api/impact
          </Link>
        </p>
      </footer>
    </article>
  );
}
