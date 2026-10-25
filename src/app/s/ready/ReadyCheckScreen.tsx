"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { t, type MessageKey } from "@/i18n";
import { readyOverview, startReadyCheckRun, submitReadyCheck } from "../../actions";
import { Equation } from "../../_components/Equation";
import { MathKeypad } from "../../_components/MathKeypad";
import { ReadyButton } from "../../_components/ReadyButton";
import { Shishya } from "../../_components/Shishya";

// The Ready check, one question at a time. The result is said kindly either way, and the first skill is always open.

type Check = { items: { itemId: string; text: string; answered: boolean }[] };
type Result = { correct: number; total: number; ready: boolean };

export function ReadyCheckScreen() {
  const [state, setState] = useState<"due" | "running" | "done" | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [answer, setAnswer] = useState("");
  const answerBox = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  function refreshOverview() {
    startTransition(async () => {
      const r = await readyOverview();
      if (!r.ok) return setNote(t("common.error"));
      setState(r.status.state);
    });
  }

  useEffect(refreshOverview, []);

  function start() {
    startTransition(async () => {
      const r = await startReadyCheckRun();
      if (!r.ok) return refreshOverview();
      setCheck({ items: r.items });
    });
  }

  const current = check?.items.find((i) => !i.answered);
  const position = check && current ? check.items.indexOf(current) + 1 : 0;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!check || !current) return;
    startTransition(async () => {
      const r = await submitReadyCheck(current.itemId, answer);
      if (!r.ok) {
        if ("errorKey" in r && r.errorKey) return setNote(t(r.errorKey as MessageKey));
        setCheck(null);
        return refreshOverview();
      }
      setNote(null);
      setAnswer("");
      setCheck({ items: check.items.map((i) => (i.itemId === current.itemId ? { ...i, answered: true } : i)) });
      if (r.finished) {
        setResult({ correct: r.correct, total: r.total, ready: r.ready });
        setCheck(null);
      }
    });
  }

  if (result) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <Shishya mood="happy" size={150} />
          <p className="text-2xl font-bold">{t(result.ready ? "ready.done.good" : "ready.done.more", { n: result.correct, total: result.total })}</p>
        </div>
        <Link href="/s/home" className="btn btn-primary self-start text-xl">
          {t("common.back")}
        </Link>
      </div>
    );
  }

  if (check && current) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-xl font-bold">{t("ready.question", { n: position, total: check.items.length })}</p>
        <div className="card flex flex-col gap-4">
          <p className="text-xl font-semibold">{t("ready.task")}</p>
          <Equation text={current.text} size="lg" />
          <form onSubmit={save} className="flex flex-col gap-3">
            <label className="flex flex-wrap items-center gap-3 text-3xl font-bold math">
              {t("ready.answer")}
              <input
                ref={answerBox}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                autoComplete="off"
                inputMode="numeric"
                className="field math text-3xl max-w-xs"
                aria-describedby="ready-hint"
              />
            </label>
            <MathKeypad value={answer} onChange={setAnswer} inputRef={answerBox} disabled={pending} />
            <p id="ready-hint" className="text-base text-gray-700">
              {t("ready.hint")}
            </p>
            <ReadyButton type="submit" className="btn btn-primary text-xl self-start" disabled={pending || !answer.trim()}>
              {t("ready.submit")}
            </ReadyButton>
          </form>
        </div>
        {note && (
          <p role="alert" className="msg-note text-xl">
            {note}
          </p>
        )}
      </div>
    );
  }

  if (!state) return <p className="text-xl">…</p>;

  if (state === "done") {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="msg-note text-xl">{t("ready.already")}</p>
        <Link href="/s/home" className="btn">
          {t("common.back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-xl">{t("ready.intro")}</p>
      <ReadyButton type="button" className="btn btn-primary text-2xl" onClick={start} disabled={pending}>
        {t("ready.start")}
      </ReadyButton>
      <Link href="/s/home" className="btn">
        {t("common.back")}
      </Link>
      {note && <p className="msg-bad">{note}</p>}
    </div>
  );
}
