"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { hasMessage, mistakeKey, skillKey, t, type MessageKey } from "@/i18n";
import { proofOverview, startProofRun, submitProof } from "../../../actions";
import { Equation } from "../../../_components/Equation";
import { Shishya } from "../../../_components/Shishya";

type Item = { itemId: string; format: "solve" | "apply"; text: string; answered: boolean };
type Run = { deadline: string; items: Item[] };
type Status = { canStart: true } | { canStart: false; code: string; retryAt?: string };
type Outcome = { passed: boolean; practise: string[]; unlocked: string[] };

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

export function ProveScreen({ skillId }: { skillId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function refreshOverview() {
    startTransition(async () => {
      const r = await proofOverview(skillId);
      if (!r.ok) return setNote(t("common.error"));
      setStatus(r.status);
      setRun(r.resume ? { deadline: r.resume.deadline, items: r.resume.items } : null);
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
      const r = await startProofRun(skillId);
      if (!r.ok) {
        setNote(null);
        refreshOverview();
        return;
      }
      setRun({ deadline: r.deadline, items: r.items.map((i) => ({ ...i, answered: false })) });
      setOutcome(null);
    });
  }

  const current = run?.items.find((i) => !i.answered);
  const position = run && current ? run.items.indexOf(current) + 1 : 0;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!run || !current) return;
    startTransition(async () => {
      const r = await submitProof(current.itemId, answer);
      if (!r.ok) {
        if ("errorKey" in r && r.errorKey) return setNote(t(r.errorKey as MessageKey));
        // finished elsewhere or time is up: show the latest status
        setRun(null);
        return refreshOverview();
      }
      setNote(null);
      setAnswer("");
      setRun({ ...run, items: run.items.map((i) => (i.itemId === current.itemId ? { ...i, answered: true } : i)) });
      if (r.finished) {
        setOutcome({ passed: r.passed, practise: r.practise, unlocked: r.unlocked });
        setRun(null);
        const after = await proofOverview(skillId);
        if (after.ok) setStatus(after.status);
      }
    });
  }

  if (outcome) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Shishya mood={outcome.passed ? "happy" : "thinking"} size={150} />
          <p className={`text-3xl font-extrabold ${outcome.passed ? "text-green-800" : "text-amber-900"}`}>
            {t(outcome.passed ? "prove.mastered" : "prove.notYet")}
          </p>
        </div>
        {outcome.passed &&
          outcome.unlocked.map((id) => (
            <p key={id} className="msg-good text-xl">
              {t("prove.nextUnlocked", { skill: t(skillKey(id, "title")) })}
            </p>
          ))}
        {!outcome.passed && (
          <ul className="flex flex-col gap-2 list-disc pl-6 text-xl">
            {outcome.practise.filter((m) => m !== "unknown" && hasMessage(mistakeKey(skillId, m))).map((m) => (
              <li key={m}>{t(mistakeKey(skillId, m))}</li>
            ))}
            {(outcome.practise.length === 0 || outcome.practise.some((m) => !hasMessage(mistakeKey(skillId, m)))) && (
              <li>{t("prove.practiseStepByStep")}</li>
            )}
          </ul>
        )}
        {!outcome.passed && status && !status.canStart && status.retryAt && (
          <p className="msg-note text-xl">{t("prove.retryAt", { time: formatTime(status.retryAt) })}</p>
        )}
        <div className="flex flex-wrap gap-3">
          {!outcome.passed && (
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
          <span>{t("prove.question", { n: position, total: run.items.length })}</span>
          {minutesLeft !== null && <span>{t("prove.timeLeft", { min: minutesLeft })}</span>}
        </div>
        <div className="card flex flex-col gap-4">
          {current.format === "apply" ? (
            <>
              <p className="font-bold text-lg text-gray-700">{t("prove.wordProblem")}</p>
              <p className="text-2xl">{current.text}</p>
            </>
          ) : (
            <>
              <p className="text-xl font-semibold">{t("practise.solve")}</p>
              <Equation text={current.text} size="lg" />
            </>
          )}
          <form onSubmit={save} className="flex flex-col gap-3">
            <label className="flex flex-wrap items-center gap-3 text-3xl font-bold math">
              {t("practise.answerLabel")}
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                autoComplete="off"
                className="field math text-3xl max-w-xs"
                aria-describedby="prove-hint"
              />
            </label>
            <p id="prove-hint" className="text-base text-gray-700">
              {t("practise.answerHint")}
            </p>
            <button type="submit" className="btn btn-primary text-xl self-start" disabled={pending || !answer.trim()}>
              {t("prove.submit")}
            </button>
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

  if (status.canStart) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-xl">{t("prove.rules")}</p>
        <button type="button" className="btn btn-primary text-2xl" onClick={start} disabled={pending}>
          {t("prove.start")}
        </button>
      </div>
    );
  }

  const messages: Record<string, MessageKey> = {
    not_ready: "prove.notReady",
    mastered: "prove.alreadyMastered",
    running: "prove.running",
  };
  return (
    <div className="flex flex-col items-start gap-4">
      {status.code === "cooldown" && status.retryAt ? (
        <p className="msg-note text-xl">{t("prove.retryAt", { time: formatTime(status.retryAt) })}</p>
      ) : (
        <p className="msg-note text-xl">{t(messages[status.code] ?? "common.error")}</p>
      )}
      {status.code === "not_ready" && (
        <Link href={`/s/teach/${encodeURIComponent(skillId)}`} className="btn btn-primary text-xl">
          {t("map.teach")}
        </Link>
      )}
      <Link href="/s/home" className="btn">
        {t("common.back")}
      </Link>
      {note && <p className="msg-bad">{note}</p>}
    </div>
  );
}
