"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { skillKey, t, type MessageKey } from "@/i18n";
import { challengeOverviewAction, saveChallengeFeedbackAction, startChallengeCheckAction, submitChallengeCheckAction } from "../../actions";
import { Equation } from "../../_components/Equation";
import { MathKeypad } from "../../_components/MathKeypad";
import { ReadyButton } from "../../_components/ReadyButton";
import { Receipt } from "../../_components/Receipt";
import { Shishya } from "../../_components/Shishya";
import { PractiseScreen } from "../practise/[skill]/PractiseScreen";
import { TeachScreen } from "../teach/[skill]/TeachScreen";
import { CodeCard } from "./CodeCard";

// The guided Shishya Challenge (F11): 1 Before · 2 Practise · 3 After · 4 Feedback, then Done (and a later check
// 3 to 21 days after). The server decides every step (challengeOverview); this screen only shows it. The practise
// step is the normal Practise screen (and, for students who teach, the normal Teach screen). A college-pack student
// (F12) has its own words, and practises two sets of questions, one after the other.

export type Overview = Extract<Awaited<ReturnType<typeof challengeOverviewAction>>, { step: string }>;
type Check = NonNullable<Overview["check"]>;
type Finished = Extract<Awaited<ReturnType<typeof submitChallengeCheckAction>>, { finished: true }>;
type Phase = Check["phase"];

const PRACTISE_SKILL = "alg.linear.both-sides";
const STEPS = ["pre", "practise", "post", "feedback"] as const;
const STEP_INDEX: Record<Overview["step"], number> = { welcome: 0, pre: 1, practise: 2, post: 3, feedback: 4, done: 5, delayed: 5 };

export function ChallengeScreen({ initial }: { initial: Overview }) {
  const [view, setView] = useState<Overview>(initial);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<Finished | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function reload() {
    const r = await challengeOverviewAction();
    if (!("step" in r)) {
      setError(t("common.error"));
      return false;
    }
    setError(null);
    setView(r);
    setRound((n) => n + 1);
    return true;
  }
  const refresh = () =>
    startTransition(async () => {
      await reload();
    });

  function startCheck(phase: Phase) {
    startTransition(async () => {
      await startChallengeCheckAction(phase); // refused (e.g. not ready yet): the overview says where the student is
      await reload();
    });
  }

  function next() {
    // The result stays until the next step has arrived. `view` still holds the finished check until then, so clearing
    // the result first would show that check's question again on a slow network, as if it had restarted.
    startTransition(async () => {
      if (await reload()) setResult(null);
    });
  }

  const bar = <StepBar current={STEP_INDEX[view.step]} />;
  const errorNote = error && (
    <p role="alert" className="msg-bad text-xl">
      {error}
    </p>
  );

  if (result) {
    return (
      <div className="flex flex-col gap-6">
        {bar}
        <CheckResult result={result} />
        <ReadyButton type="button" className="btn btn-primary text-2xl self-start" onClick={next} disabled={pending}>
          {t("challenge.next")}
        </ReadyButton>
        {errorNote}
      </div>
    );
  }

  let body;
  switch (view.step) {
    case "welcome":
      body = (
        <>
          <CodeCard code={view.code} classCode={view.classCode} />
          <p className="text-xl">{t(view.college ? "challenge.intro.college" : "challenge.intro")}</p>
          <ReadyButton type="button" className="btn btn-primary text-2xl self-start" onClick={() => startCheck("pre")} disabled={pending}>
            {t("challenge.start")}
          </ReadyButton>
        </>
      );
      break;
    case "pre":
    case "post":
    case "delayed":
      body = view.check ? (
        <CheckRunner key={view.check.checkId} check={view.check} onFinished={setResult} onLost={refresh} />
      ) : (
        <ReadyButton type="button" className="btn btn-primary text-2xl self-start" onClick={refresh} disabled={pending}>
          {t("challenge.next")}
        </ReadyButton>
      );
      break;
    case "practise":
      body = <PractiseStep key={round} view={view} onPost={() => startCheck("post")} onTaught={refresh} pending={pending} />;
      break;
    case "feedback":
      body = <FeedbackForm teach={view.teach} onSaved={refresh} />;
      break;
    case "done":
      body = <Done view={view} onDelayed={() => startCheck("delayed")} pending={pending} />;
      break;
  }

  return (
    <div className="flex flex-col gap-6">
      {bar}
      {body}
      {errorNote}
    </div>
  );
}

/** 1 Before · 2 Practise · 3 After · 4 Feedback, with the current step marked. */
function StepBar({ current }: { current: number }) {
  return (
    <ol aria-label={t("challenge.steps")} className="flex flex-wrap gap-2 no-print">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "now" : "later";
        return (
          <li
            key={s}
            aria-current={state === "now" ? "step" : undefined}
            className={`rounded-full border-2 px-3 py-1 text-lg font-bold ${
              state === "now" ? "border-blue-800 bg-blue-800 text-white" : state === "done" ? "border-green-700 text-green-800" : "border-gray-400 text-gray-700"
            }`}
          >
            {n} {t(`challenge.step.${s}`)}
            {state === "done" && <span className="sr-only"> ({t("challenge.stepDone")})</span>}
            {state === "now" && <span className="sr-only"> ({t("challenge.stepNow")})</span>}
          </li>
        );
      })}
    </ol>
  );
}

const CHECK_TITLE: Record<Phase, [MessageKey, MessageKey]> = {
  pre: ["challenge.pre.title", "challenge.pre.intro"],
  post: ["challenge.post.title", "challenge.post.intro"],
  delayed: ["challenge.delayed.title", "challenge.delayed.intro"],
};

/** One question at a time, the keypad, no hints and no verdict until the end. */
function CheckRunner({ check, onFinished, onLost }: { check: Check; onFinished: (r: Finished) => void; onLost: () => void }) {
  const [items, setItems] = useState(check.items);
  const [answer, setAnswer] = useState("");
  const answerBox = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = items.find((i) => !i.answered);
  const position = current ? items.indexOf(current) + 1 : items.length;
  const [title, intro] = CHECK_TITLE[check.phase];

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    startTransition(async () => {
      const r = await submitChallengeCheckAction(current.itemId, answer);
      if (!r.ok) {
        if ("errorKey" in r && r.errorKey) return setNote(t(r.errorKey as MessageKey));
        return onLost(); // already finished elsewhere (another tab): the overview says where the student is
      }
      setNote(null);
      setAnswer("");
      setItems((xs) => xs.map((i) => (i.itemId === current.itemId ? { ...i, answered: true } : i)));
      if (r.finished) onFinished(r);
    });
  }

  if (!current) return <p className="text-xl">…</p>;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">{t(title)}</h1>
      {position === 1 && <p className="text-xl">{t(intro)}</p>}
      <p className="text-xl font-bold">{t("challenge.check.question", { n: position, total: items.length })}</p>
      <div className="card flex flex-col gap-4">
        <p className="text-xl font-semibold">{t(skillKey(current.skillId, "task"))}</p>
        <Equation text={current.text} size="lg" />
        <form onSubmit={save} className="flex flex-col gap-3">
          <label className="flex flex-wrap items-center gap-3 text-3xl font-bold math">
            {t(skillKey(current.skillId, "answerLabel"))}
            <input
              ref={answerBox}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoComplete="off"
              className="field math text-3xl max-w-xs"
              aria-describedby="check-hint"
            />
          </label>
          <MathKeypad value={answer} onChange={setAnswer} inputRef={answerBox} disabled={pending} />
          <p id="check-hint" className="text-base text-gray-700">
            {t("practise.answerHint")}
          </p>
          <ReadyButton type="submit" className="btn btn-primary text-xl self-start" disabled={pending || !answer.trim()}>
            {t("challenge.check.save")}
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

/** The end of a check: the score (and, after the after check, before → after) and "How we checked" for each answer. */
function CheckResult({ result }: { result: Finished }) {
  const [title] = CHECK_TITLE[result.phase];
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">{t(title)}</h1>
      <div className="flex flex-wrap items-center gap-4">
        <Shishya mood="happy" size={110} />
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-bold">
            {result.phase === "post" && result.before !== null
              ? t("challenge.beforeAfter", { before: result.before, after: result.score, total: result.total })
              : t("challenge.check.result", { n: result.score, total: result.total })}
          </p>
          {result.minutes !== undefined && <p className="text-xl">{t("challenge.timeTaken", { n: result.minutes })}</p>}
        </div>
      </div>
      <section aria-label={t("prove.receipts")} className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">{t("prove.receipts")}</h2>
        {result.receipts.map((r, i) => (
          <div key={r.itemId} className="flex flex-col gap-2">
            <p className="text-xl font-semibold">{t("prove.question", { n: i + 1, total: result.receipts.length })}</p>
            <Equation text={r.question} size="md" />
            {r.receipt ? <Receipt receipt={r.receipt} /> : <p className="msg-note">{t("prove.notAnswered")}</p>}
          </div>
        ))}
      </section>
    </div>
  );
}

/**
 * Practise: everyone answers the pack's sets of questions, one set after the other (the normal Practise screen, hints
 * allowed); students who teach then teach the Shishya once (the normal Teach screen). After that, or after 12 minutes
 * in this step, "Next" goes to the after check. The server checks both again before it starts the after check.
 */
function PractiseStep({ view, onPost, onTaught, pending }: { view: Overview; onPost: () => void; onTaught: () => void; pending: boolean }) {
  const p = view.practise!;
  // the school pack has one set on "x on both sides"; the server names the college pack's sets
  const sets = p.sets ?? [{ skillId: PRACTISE_SKILL, target: p.target, done: p.done }];
  const teachSkill = p.teachSkill ?? PRACTISE_SKILL;
  const [counts, setCounts] = useState(sets.map((s) => s.done));
  const firstOpen = sets.findIndex((s) => s.done < s.target);
  const [setIndex, setSetIndex] = useState(firstOpen === -1 ? sets.length : firstOpen);
  const leftPractice = setIndex >= sets.length;
  const current = sets[setIndex];
  const [taught, setTaught] = useState(p.teachDone);
  const [canSkip, setCanSkip] = useState(p.skipInSeconds === 0);

  useEffect(() => {
    if (p.skipInSeconds === 0) return;
    const timer = setTimeout(() => setCanSkip(true), p.skipInSeconds * 1000 + 500);
    return () => clearTimeout(timer);
  }, [p.skipInSeconds]);

  const setDoneAll = leftPractice && (!view.teach || taught);
  const toPost = (
    <ReadyButton type="button" className="btn btn-primary text-2xl self-start" onClick={onPost} disabled={pending}>
      {setDoneAll ? t("challenge.practise.toPost") : t("challenge.practise.skip")}
    </ReadyButton>
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">{t(view.college ? "challenge.practise.title.college" : "challenge.practise.title")}</h1>
      <p className="text-xl font-bold" aria-live="polite">
        {t("challenge.practise.count", { n: sets.reduce((sum, s, i) => sum + Math.min(counts[i], s.target), 0), total: p.target })}
      </p>
      {setDoneAll ? (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Shishya mood="happy" size={110} />
            <p className="text-2xl font-bold">{t("challenge.practise.allDone")}</p>
          </div>
          {toPost}
        </>
      ) : (
        <>
          {canSkip && (
            <div className="msg-note flex flex-col gap-3">
              <p className="text-lg">{t("challenge.practise.skipNote")}</p>
              {toPost}
            </div>
          )}
          {current ? (
            <>
              {view.college && <h2 className="text-2xl font-bold">{t(skillKey(current.skillId, "title"))}</h2>}
              <PractiseScreen
                key={current.skillId}
                skillId={current.skillId}
                answerKind="number"
                challenge={{
                  left: current.target - counts[setIndex],
                  onAnswered: () => setCounts((c) => c.map((n, i) => (i === setIndex ? n + 1 : n))),
                  onDone: () => setSetIndex((i) => i + 1),
                }}
              />
            </>
          ) : (
            <>
              <p className="msg-good text-xl">{t("challenge.practise.teachNow")}</p>
              <TeachScreen
                skillId={teachSkill}
                challenge={{
                  onDone: () => {
                    setTaught(true);
                    onTaught();
                  },
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

const FACES = ["😞", "🙁", "😐", "🙂", "😄"];

function Rating({ name, legend, value, onChange }: { name: string; legend: string; value: number | null; onChange: (n: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xl font-bold">{legend}</legend>
      <p className="text-base text-gray-700">{t("challenge.fb.scale")}</p>
      <div className="grid grid-cols-5 gap-2">
        {FACES.map((face, i) => {
          const n = i + 1;
          return (
            <label
              key={n}
              className={`flex min-h-16 flex-col items-center justify-center rounded-lg border-2 text-xl font-bold ${
                value === n ? "border-blue-800 bg-blue-100" : "border-gray-400"
              }`}
            >
              <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" aria-label={t("challenge.fb.rate", { n })} />
              <span aria-hidden="true" className="text-3xl">
                {face}
              </span>
              <span aria-hidden="true">{n}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const COMMENT_MAX = 200;

function FeedbackForm({ teach, onSaved }: { teach: boolean; onSaved: () => void }) {
  const [useful, setUseful] = useState<number | null>(null);
  const [teachHelped, setTeachHelped] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [quoteOk, setQuoteOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await saveChallengeFeedbackAction({ useful, teachHelped: teach ? teachHelped : null, comment, quoteOk: comment.trim() ? quoteOk : null });
      if (r.ok) return onSaved();
      setError(t("errorKey" in r && r.errorKey ? (r.errorKey as MessageKey) : "common.error"));
    });
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-6">
      <h1 className="text-3xl font-extrabold">{t("challenge.fb.title")}</h1>
      <Rating name="useful" legend={t("challenge.fb.useful")} value={useful} onChange={setUseful} />
      {teach && <Rating name="teachHelped" legend={t("challenge.fb.teach")} value={teachHelped} onChange={setTeachHelped} />}
      <label className="flex flex-col gap-1 text-xl font-bold">
        {t("challenge.fb.comment")}
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={COMMENT_MAX}
          autoComplete="off"
          className="field text-xl font-normal"
          aria-describedby="comment-warning comment-left"
        />
        <span id="comment-warning" className="msg-note text-base font-semibold">
          {t("challenge.fb.warning")}
        </span>
        <span id="comment-left" className="text-base font-normal text-gray-700">
          {t("challenge.fb.left", { n: COMMENT_MAX - comment.length })}
        </span>
      </label>
      {comment.trim() && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xl font-bold">{t("challenge.fb.quote")}</legend>
          <div className="flex flex-wrap gap-3">
            {[true, false].map((v) => (
              <label key={String(v)} className={`flex min-h-12 items-center gap-3 rounded-lg border-2 px-4 text-xl font-semibold ${quoteOk === v ? "border-blue-800 bg-blue-100" : "border-gray-400"}`}>
                <input type="radio" name="quoteOk" checked={quoteOk === v} onChange={() => setQuoteOk(v)} className="h-6 w-6 shrink-0" />
                {t(v ? "challenge.fb.yes" : "challenge.fb.no")}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="msg-bad text-xl">
          {error}
        </p>
      )}
      <ReadyButton type="submit" className="btn btn-primary text-2xl self-start" disabled={pending}>
        {t("challenge.fb.send")}
      </ReadyButton>
    </form>
  );
}

/** Thanks, before → after, and the later check: when to come back (with both codes), or "open now". */
function Done({ view, onDelayed, pending }: { view: Overview; onDelayed: () => void; pending: boolean }) {
  const { scores, delayed } = view;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <Shishya mood="happy" size={130} />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold">{t("challenge.done.title")}</h1>
          <p className="text-xl">{t("challenge.done.thanks")}</p>
        </div>
      </div>
      {scores.pre !== null && scores.post !== null && (
        <p className="text-2xl font-bold">{t("challenge.beforeAfter", { before: scores.pre, after: scores.post, total: scores.total })}</p>
      )}
      {view.minutesTaken !== undefined && <p className="text-xl">{t("challenge.timeTaken", { n: view.minutesTaken })}</p>}
      {scores.delayed !== null && <p className="text-2xl font-bold">{t("challenge.done.delayed", { n: scores.delayed, total: scores.delayedTotal })}</p>}
      {delayed?.state === "later" && (
        <p className="card text-xl font-semibold">{t("challenge.done.later", { classCode: view.classCode, code: view.code })}</p>
      )}
      {delayed?.state === "due" && (
        <div className="card flex flex-col items-start gap-3 border-green-700">
          <p className="text-xl font-semibold">{t("challenge.done.due")}</p>
          <ReadyButton type="button" className="btn btn-primary text-2xl" onClick={onDelayed} disabled={pending}>
            {t("challenge.done.start")}
          </ReadyButton>
        </div>
      )}
      <p className="text-lg">{t("challenge.done.skills")}</p>
      <Link href="/s/home" className="btn self-start">
        {t("challenge.done.toSkills")}
      </Link>
    </div>
  );
}
