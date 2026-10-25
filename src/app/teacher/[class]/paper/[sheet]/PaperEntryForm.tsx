"use client";

import { useActionState } from "react";
import { t } from "@/i18n";
import { savePaperAction, type PaperSaveState } from "../../../../actions";

// The answer grid of a paper worksheet: one row per child code, one box per question. A server-action form, so
// it posts even before the page is ready. A saved box is shown as text (it cannot be changed); a box the parser
// could not read keeps what the teacher typed, so it can be checked and saved again.

type Cell = { answer: string; correct: boolean } | null;

const shown = (answer: string) => answer.replace(/-/g, "−");

export function PaperEntryForm({
  classCode,
  sheetCode,
  questions,
  grid,
}: {
  classCode: string;
  sheetCode: string;
  questions: number[];
  grid: { code: string; cells: Cell[] }[];
}) {
  const [state, action, pending] = useActionState<PaperSaveState, FormData>(savePaperAction.bind(null, classCode, sheetCode), {
    status: "idle",
    round: 0,
  });
  const retyped = new Map(state.status === "saved" ? state.unreadable.map((u) => [`${u.studentCode}:${u.question}`, u.text]) : []);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.status === "saved" && (
        <div role="status" className="msg-good flex flex-col gap-1">
          <p>{t("paper.grid.saved", { n: state.saved, right: state.correct })}</p>
          {state.already > 0 && <p>{t("paper.grid.already", { n: state.already })}</p>}
        </div>
      )}
      {state.status === "saved" && state.unreadable.length > 0 && (
        <div role="alert" className="msg-bad flex flex-col gap-1">
          <p>{t("paper.grid.unreadable")}</p>
          <ul>
            {state.unreadable.map((u) => (
              <li key={`${u.studentCode}:${u.question}`} className="math">
                {t("paper.grid.unreadableItem", { code: u.studentCode, n: u.question, text: u.text })}
              </li>
            ))}
          </ul>
        </div>
      )}
      {state.status === "error" && (
        <p role="alert" className="msg-bad">
          {t(state.error)}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="border-collapse text-lg">
          <thead>
            <tr className="border-b-2 border-gray-400 text-left">
              <th className="py-2 pr-3">{t("paper.grid.child")}</th>
              {questions.map((n) => (
                <th key={n} className="py-2 pr-2">
                  {t("paper.grid.q", { n })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row.code} className="border-b border-gray-300">
                <th scope="row" className="py-1 pr-3 text-left math font-semibold whitespace-nowrap">
                  {row.code}
                </th>
                {row.cells.map((cell, i) => {
                  const n = questions[i];
                  const label = `${row.code} ${t("paper.grid.q", { n })}`;
                  return (
                    <td key={n} className="py-1 pr-2">
                      {cell ? (
                        <span className={`math whitespace-nowrap font-semibold ${cell.correct ? "text-green-800" : "text-red-800"}`}>
                          {shown(cell.answer)}{" "}
                          <span aria-label={t(cell.correct ? "paper.grid.right" : "paper.grid.wrong")}>{cell.correct ? "✓" : "✗"}</span>
                        </span>
                      ) : (
                        <input
                          key={`${state.round}:${row.code}:${n}`}
                          name={`c:${row.code}:${n}`}
                          defaultValue={retyped.get(`${row.code}:${n}`) ?? ""}
                          aria-label={label}
                          autoComplete="off"
                          maxLength={40}
                          className="field math w-24"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-base text-gray-700">{t("paper.grid.note")}</p>
      <button type="submit" className="btn btn-primary self-start" disabled={pending}>
        {t("paper.grid.save")}
      </button>
    </form>
  );
}
