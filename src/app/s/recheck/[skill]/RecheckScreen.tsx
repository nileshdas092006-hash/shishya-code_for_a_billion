"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { skillKey, t, type MessageKey } from "@/i18n";
import { recheckOverview, startRecheckRun, submitRecheck } from "../../../actions";
import { Equation } from "../../../_components/Equation";
import { MathKeypad } from "../../../_components/MathKeypad";
import { ReadyButton } from "../../../_components/ReadyButton";
import { Shishya } from "../../../_components/Shishya";

// The quick check: the questions only (no hints, no "check line" help), one at a time, and the result at the end.

type Run = { deadline: string; items: { itemId: string; text: string; answered: boolean }[] };
type Status = { running: boolean; due: boolean; last: { passed: boolean; at: string } | null };

export function RecheckScreen({ skillId, answerKind }: { skillId: string; answerKind: "number" | "expression" }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [answer, setAnswer] = useState("");
  const answerBox = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function refreshOverview() {
    startTransition(async () => {
      const r = await recheckOverview(skillId);
      if (!r.ok) return setNote(t("common.error"));
      setStatus(r.status);
    });
  }

  useEffect(refreshOverview, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!run) return;
    const tick = () => setMinutesLeft(Math.max(0, Math.ceil((Date.parse(run.deadline) - Date.now()) / 60_000)));
    tick();
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, [run]);

  function start() {
    startTransition(async () => {
      const r = await startRecheckRun(skillId);
      if (!r.ok) return refreshOverview();
      setRun({ deadline: r.deadline, items: r.items });
    });
  }

  const current = run?.items.find((i) => !i.answered);
  const position = run && current ? run.items.indexOf(current) + 1 : 0;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!run || !current) return;
    startTransition(async () => {
      const r = await submitRecheck(current.itemId, answer);
      if (!r.ok) {
        if ("errorKey" in r && r.errorKey) return setNote(t(r.errorKey as MessageKey));
        setRun(null);
        return refreshOverview();
      }
      setNote(null);
      setAnswer("");
      setRun({ ...run, items: run.items.map((i) => (i.itemId === current.itemId ? { ...i, answered: true } : i)) });
      if (r.finished) {
        setPassed(r.passed);
        setRun(null);
      }
    });
  }

  if (passed !== null) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <Shishya mood={passed ? "happy" : "thinking"} size={150} />
          <p className={`text-3xl font-extrabold ${passed ? "text-green-800" : "text-amber-900"}`}>
            {t(passed ? "recheck.passed" : "recheck.again")}
          </p>
        </div>
        <p className="text-xl">{t("recheck.stays")}</p>
        <div className="flex flex-wrap gap-3">
          {!passed && (
            <Link href={`/s/practise/${encodeURIComponent(skillId)}`} className="btn btn-primary text-xl">
              {t("map.practise")}
            </Link>
          )}
          <Link href="/s/home" className="btn text-xl">
            {t("common.back")}
          </Link>
        </div>
      </div>
    );
  }

  if (run && current) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap justify-between gap-3 text-xl font-bold">
          <span>{t("recheck.question", { n: position, total: run.items.length })}</span>
          {minutesLeft !== null && <span>{t("recheck.timeLeft", { min: minutesLeft })}</span>}
        </div>
        <div className="card flex flex-col gap-4">
          <p className="text-xl font-semibold">{t(skillKey(skillId, "task"))}</p>
          <Equation text={current.text} size="lg" />
          <form onSubmit={save} className="flex flex-col gap-3">
            <label className="flex flex-wrap items-center gap-3 text-3xl font-bold math">
              {t(skillKey(skillId, "answerLabel"))}
              <input
                ref={answerBox}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                autoComplete="off"
                className="field math text-3xl max-w-xs"
                aria-describedby="recheck-hint"
              />
            </label>
            <MathKeypad value={answer} onChange={setAnswer} inputRef={answerBox} disabled={pending} />
            <p id="recheck-hint" className="text-base text-gray-700">
              {t(answerKind === "expression" ? "practise.answerHint.expression" : "practise.answerHint")}
            </p>
            <ReadyButton type="submit" className="btn btn-primary text-xl self-start" disabled={pending || !answer.trim()}>
              {t("recheck.submit")}
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

  if (!status) return <p className="text-xl">…</p>;

  if (status.due || status.running) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-xl">{t("recheck.intro")}</p>
        <ReadyButton type="button" className="btn btn-primary text-2xl" onClick={start} disabled={pending}>
          {t("recheck.start")}
        </ReadyButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="msg-note text-xl">
        {status.last?.passed ? t("recheck.passed") : status.last ? t("recheck.again.map") : t("recheck.notDue")}
      </p>
      <Link href="/s/home" className="btn">
        {t("common.back")}
      </Link>
      {note && <p className="msg-bad">{note}</p>}
    </div>
  );
}
