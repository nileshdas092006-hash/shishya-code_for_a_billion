import { skillKey, t } from "@/i18n";

// The stuck board's grid and its "one slip, watching" list. Plain server-rendered markup (no JavaScript).
// Every count is printed, so colour is never the only signal; at phone width the grid scrolls in its own box.

type Grid = { lines: number[]; rows: { skillId: string; counts: number[] }[] };
type Slips = { skillId: string; students: { code: string; line: number | null }[] }[];

/** Darker for more children; the text stays readable on every shade. */
function shade(count: number): string {
  if (count === 0) return "bg-white text-gray-700";
  if (count === 1) return "bg-amber-100 text-gray-900";
  if (count === 2) return "bg-amber-200 text-gray-900";
  if (count <= 4) return "bg-amber-400 text-gray-900";
  return "bg-amber-700 text-white";
}

export function PatternGrid({ grid }: { grid: Grid }) {
  return (
    <div className="overflow-x-auto max-w-full rounded-xl border-2 border-gray-300" role="region" aria-label={t("board.grid.title")} tabIndex={0}>
      <table className="w-full border-collapse text-lg">
        <thead>
          <tr className="border-b-2 border-gray-400 text-left">
            <th scope="col" className="py-2 px-2 sm:px-3">{t("board.grid.skill")}</th>
            {grid.lines.map((n) => (
              <th key={n} scope="col" className="py-2 px-2 sm:px-3 text-center math">{t("board.grid.line", { n })}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((r) => (
            <tr key={r.skillId} className="border-b border-gray-300">
              <th scope="row" className="py-2 px-2 sm:px-3 text-left font-semibold">{t(skillKey(r.skillId, "title"))}</th>
              {r.counts.map((count, i) => (
                <td key={grid.lines[i]} className={`${shade(count)} py-2 px-2 sm:px-3 text-center font-bold`} data-count={count}>{count}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SlipList({ slips }: { slips: Slips }) {
  return (
    <article className="card flex flex-col gap-2">
      <h3 className="text-xl font-bold">{t("board.slips.title")}</h3>
      <p className="text-gray-700">{t("board.slips.intro")}</p>
      <ul className="flex flex-col gap-1">
        {slips.map((s) => (
          <li key={s.skillId}>
            <span className="font-semibold">{t(skillKey(s.skillId, "title"))}:</span>{" "}
            <span className="math">
              {s.students.map((x) => (x.line === null ? x.code : t("board.slips.at", { code: x.code, n: x.line }))).join(", ")}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
