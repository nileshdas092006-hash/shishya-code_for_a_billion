"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { hasMessage, hintKey, keepMathTogether, mistakeKey, skillKey, t, type MessageKey } from "@/i18n";
import { answerPractice, servePractice } from "../../../actions";
import { Equation } from "../../../_components/Equation";
import { Shishya } from "../../../_components/Shishya";

const STREAK_FOR_TEACH = 5;
const HINT_LEVELS = 4;

type Feedback = { kind: "good" | "bad" | "note"; text: string; detail?: string } | null;

export function PractiseScreen({ skillId, answerKind }: { skillId: string; answerKind: "number" | "expression" }) {
  const [item, setItem] = useState<{ itemId: string; text: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hints, setHints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [pending, startTransition] = useTransition();

  function loadNext() {
    startTransition(async () => {
      const r = await servePractice(skillId);
      if (!r.ok) {
        setFeedback({ kind: "bad", text: t(r.code === "locked" ? "common.locked" : "common.error") });
        return;
      }
      setItem({ itemId: r.itemId, text: r.text });
      setAnswer("");
      setAnswered(false);
      setFeedback(null);
      setHints(0);
    });
  }

  useEffect(loadNext, []); // eslint-disable-line react-hooks/exhaustive-deps

  function check(e: React.FormEvent) {
    e.preventDefault();
    if (!item || answered) return;
    startTransition(async () => {
      const r = await answerPractice(item.itemId, answer);
      if (!r.ok) {
        const key = "errorKey" in r && r.errorKey ? (r.errorKey as MessageKey) : "common.error";
        setFeedback({ kind: "note", text: t(key) });
        return;
      }
      setAnswered(true);
      if (r.correct) {
        setStreak((s) => s + 1);
        setFeedback({ kind: "good", text: t("practise.correct") });
      } else {
        setStreak(0);
        setFeedback(
          r.mistakeId && r.mistakeId !== "unknown"
            ? {
                kind: "bad",
                text: t("practise.wrongKnown"),
                // a teacher-approved mined mistake has no translation yet: use its own child label
                detail: hasMessage(mistakeKey(skillId, r.mistakeId)) ? t(mistakeKey(skillId, r.mistakeId)) : keepMathTogether(r.feedback),
              }
            : { kind: "bad", text: t("practise.wrongUnknown") },
        );
      }
    });
  }

  if (!item) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xl">{t("practise.loading")}</p>
        {feedback && <p className="msg-bad">{feedback.text}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4">
        <p className="text-xl font-semibold">{t(skillKey(skillId, "task"))}</p>
        <Equation text={item.text} size="lg" />
        <form onSubmit={check} className="flex flex-col gap-3">
          <label className="flex flex-wrap items-center gap-3 text-3xl font-bold math">
            {t(skillKey(skillId, "answerLabel"))}
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={answered}
              inputMode="text"
              autoComplete="off"
              className="field math text-3xl max-w-xs"
              aria-describedby="answer-hint"
            />
          </label>
          <p id="answer-hint" className="text-base text-gray-700">
            {t(answerKind === "expression" ? "practise.answerHint.expression" : "practise.answerHint")}
          </p>
          {!answered && (
            <button type="submit" className="btn btn-primary text-xl self-start" disabled={pending || !answer.trim()}>
              {t("practise.check")}
            </button>
          )}
        </form>
      </div>

      {feedback && (
        <div role="status" className={`msg-${feedback.kind} text-xl flex items-center gap-4`}>
          <Shishya mood={feedback.kind === "good" ? "happy" : "confused"} size={70} />
          <div className="flex flex-col gap-1">
            <span className="font-bold">{feedback.text}</span>
            {feedback.detail && <span>{feedback.detail}</span>}
          </div>
        </div>
      )}

      {answered && (
        <button type="button" className="btn btn-primary text-xl self-start" onClick={loadNext} disabled={pending}>
          {t("practise.next")}
        </button>
      )}

      <section aria-label={t("practise.hint")} className="flex flex-col gap-3">
        {Array.from({ length: hints }, (_, i) => (
          <div key={i} className="card">
            <p className="font-bold">{t("practise.hintLevel", { n: i + 1 })}</p>
            <p className="text-lg">{t(hintKey(skillId, i + 1))}</p>
          </div>
        ))}
        {hints < HINT_LEVELS ? (
          <button type="button" className="btn self-start" onClick={() => setHints((h) => h + 1)}>
            {t("practise.hint")}
          </button>
        ) : (
          <p className="text-gray-700">{t("practise.noMoreHints")}</p>
        )}
      </section>

      <p className="text-lg">{t("practise.streak", { n: streak })}</p>
      {streak >= STREAK_FOR_TEACH && (
        <div className="msg-good flex flex-wrap items-center gap-4 text-xl">
          <span>{t("practise.offerTeach")}</span>
          <Link href={`/s/teach/${encodeURIComponent(skillId)}`} className="btn btn-primary">
            {t("map.teach")}
          </Link>
        </div>
      )}
    </div>
  );
}
