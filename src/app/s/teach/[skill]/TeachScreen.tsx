"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { t, type MessageKey } from "@/i18n";
import { startTeachSession, submitTeach } from "../../../actions";
import { Shishya, type Mood } from "../../../_components/Shishya";
import { TraceLines } from "../../../_components/TraceLines";
import { ReadyButton } from "../../../_components/ReadyButton";
import { MathKeypad } from "../../../_components/MathKeypad";
import { Receipt } from "../../../_components/Receipt";
import type { LineReceipt } from "@/core/receipt";

type Trace = { itemId: string; question: string; lines: string[] };
type Result = { ok: boolean; text: string; receipt?: LineReceipt | null };

const TRIES = 2;

export function TeachScreen({ skillId }: { skillId: string }) {
  const [traces, setTraces] = useState<Trace[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const typedBox = useRef<HTMLInputElement>(null);
  const [triesLeft, setTriesLeft] = useState(TRIES);
  const [result, setResult] = useState<Result | null>(null);
  const [fixed, setFixed] = useState(0);
  const [mood, setMood] = useState<Mood>("confused");
  const [finalState, setFinalState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const trace = traces?.[index];
  const traceDone = result?.ok || triesLeft === 0;
  const allDone = traces !== null && index >= traces.length;

  function start() {
    startTransition(async () => {
      const r = await startTeachSession(skillId);
      if (!r.ok) {
        setError(t(r.code === "locked" ? "common.locked" : "common.error"));
        return;
      }
      setTraces(r.traces);
      setIndex(0);
      setFixed(0);
      setFinalState(null);
      resetTrace();
    });
  }

  function resetTrace() {
    setSelected(null);
    setTyped("");
    setTriesLeft(TRIES);
    setResult(null);
    setMood("confused");
  }

  function choose(line: number) {
    if (!trace || traceDone) return;
    setSelected(line);
    setTyped(trace.lines[line - 1]);
    setResult(null);
    setMood("thinking");
  }

  function check(e: React.FormEvent) {
    e.preventDefault();
    if (!trace || selected === null) return;
    startTransition(async () => {
      const r = await submitTeach(trace.itemId, selected, typed);
      if (!r.ok) {
        if (r.code === "no_tries" || r.code === "already_fixed") setTriesLeft(0);
        else setError(t("common.error"));
        return;
      }
      const good = r.lineCorrect && r.fixAccepted;
      setResult({ ok: good, text: t(r.feedbackKey as MessageKey, r.feedbackParams), receipt: r.receipt });
      setTriesLeft(r.triesLeft);
      setMood(good ? "happy" : "confused");
      if (good) setFixed((f) => f + 1);
      setFinalState(r.state);
    });
  }

  function next() {
    setIndex((i) => i + 1);
    resetTrace();
  }

  if (error) return <p className="msg-bad text-xl">{error}</p>;

  if (!traces) {
    return (
      <div className="flex flex-col items-start gap-4">
        <div className="flex items-center gap-4">
          <Shishya mood="confused" size={120} />
          <p className="text-xl">{t("teach.intro")}</p>
        </div>
        <ReadyButton type="button" className="btn btn-primary text-xl" onClick={start} disabled={pending}>
          {t("teach.start")}
        </ReadyButton>
      </div>
    );
  }

  const total = traces.length;
  const bar = (
    <div className="flex flex-col gap-1" aria-live="polite">
      <span className="font-bold">{t("teach.progress", { n: fixed, total })}</span>
      <div
        className="h-6 w-full rounded-full bg-gray-200 border-2 border-gray-400 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={fixed}
      >
        <div className="h-full bg-green-600" style={{ width: `${(fixed / total) * 100}%` }} />
      </div>
    </div>
  );

  if (allDone) {
    const key: MessageKey =
      finalState === "KEY1" ? "teach.done.key1" : finalState === "NOT_YET" || finalState === "MASTERED" ? "teach.done.thanks" : "teach.done.again";
    return (
      <div className="flex flex-col gap-5">
        {bar}
        <div className="flex items-center gap-4">
          <Shishya mood={finalState === "KEY1" ? "happy" : "thinking"} size={140} />
          <p className="text-2xl font-bold">{t(key)}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {finalState === "KEY1" && (
            <Link href={`/s/prove/${encodeURIComponent(skillId)}`} className="btn btn-primary text-xl">
              {t("map.prove")}
            </Link>
          )}
          <ReadyButton type="button" className="btn" onClick={start} disabled={pending}>
            {t("teach.start")}
          </ReadyButton>
          <Link href="/s/home" className="btn">
            {t("common.back")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {bar}
      <div className="flex items-center gap-4">
        <Shishya mood={mood} size={110} />
        <p className="text-xl font-semibold" aria-live="polite">
          {t(mood === "happy" ? "teach.shishya.happy" : mood === "thinking" ? "teach.shishya.thinking" : "teach.shishya.confused")}
        </p>
      </div>
      <p className="text-xl">{t("teach.intro")}</p>
      <TraceLines lines={trace!.lines} selected={selected} onSelect={choose} disabled={traceDone || pending} />

      {selected !== null && !traceDone && (
        <form onSubmit={check} className="card flex flex-col gap-3">
          <p className="text-lg">{t("teach.tapped", { n: selected })}</p>
          <label className="flex flex-col gap-1 font-semibold">
            {t("teach.typeLabel", { n: selected })}
            <input
              ref={typedBox}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="field math text-3xl"
              aria-describedby="type-hint"
            />
          </label>
          <MathKeypad value={typed} onChange={setTyped} inputRef={typedBox} disabled={pending} />
          <p id="type-hint" className="text-base text-gray-700">
            {t("teach.typeHint")}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <ReadyButton type="submit" className="btn btn-primary text-xl" disabled={pending || !typed.trim()}>
              {t("teach.check")}
            </ReadyButton>
            <span className="text-lg">{t("teach.triesLeft", { n: triesLeft })}</span>
          </div>
        </form>
      )}

      {result && (
        <p role="status" className={`${result.ok ? "msg-good" : "msg-bad"} text-xl`}>
          {result.text}
        </p>
      )}
      {result?.receipt && selected !== null && <Receipt receipt={result.receipt} line={selected - 1} />}
      {!result?.ok && triesLeft === 0 && <p className="msg-note text-xl">{t("teach.noTries")}</p>}
      {traceDone && (
        <ReadyButton type="button" className="btn btn-primary text-xl self-start" onClick={next}>
          {t("teach.next")}
        </ReadyButton>
      )}
    </div>
  );
}
