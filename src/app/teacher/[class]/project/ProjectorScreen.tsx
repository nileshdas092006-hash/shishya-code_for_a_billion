"use client";

import { useState, useTransition } from "react";
import { skillKey, t, type MessageKey } from "@/i18n";
import { projectorCheckLine, projectorNew } from "../../../actions";
import { Shishya, type Mood } from "../../../_components/Shishya";
import { TraceLines } from "../../../_components/TraceLines";

type Trace = { seed: number; mistakeId: string; question: string; lines: string[] };

export function ProjectorScreen({ classCode, skillIds }: { classCode: string; skillIds: string[] }) {
  const [skillId, setSkillId] = useState(skillIds[0]);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [mood, setMood] = useState<Mood>("confused");
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const r = await projectorNew(classCode, skillId);
      if (!r.ok) return setResult({ ok: false, text: t("common.error") });
      setTrace({ seed: r.seed, mistakeId: r.mistakeId, question: r.question, lines: r.lines });
      setSelected(null);
      setTyped("");
      setResult(null);
      setMood("confused");
    });
  }

  function choose(line: number) {
    if (!trace) return;
    setSelected(line);
    setTyped(trace.lines[line - 1]);
    setResult(null);
    setMood("thinking");
  }

  function check(e: React.FormEvent) {
    e.preventDefault();
    if (!trace || selected === null) return;
    startTransition(async () => {
      const r = await projectorCheckLine(classCode, skillId, trace.seed, trace.mistakeId, selected, typed);
      if (!r.ok) return setResult({ ok: false, text: t("common.error") });
      const good = r.lineCorrect && r.fixAccepted;
      setResult({ ok: good, text: t(r.feedbackKey as MessageKey, r.feedbackParams) });
      setMood(good ? "happy" : "confused");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-4xl font-extrabold">{t("project.title")}</h1>
        {skillIds.length > 1 && (
          <select value={skillId} onChange={(e) => setSkillId(e.target.value)} className="field max-w-xs" aria-label="Skill">
            {skillIds.map((id) => (
              <option key={id} value={id}>
                {t(skillKey(id, "title"))}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn btn-primary text-2xl" onClick={load} disabled={pending}>
          {t("project.newTrace")}
        </button>
      </div>

      {trace && (
        <>
          <div className="flex items-center gap-6">
            <Shishya mood={mood} size={200} />
            <p className="text-4xl font-bold">
              {t(mood === "happy" ? "teach.shishya.happy" : mood === "thinking" ? "teach.shishya.thinking" : "teach.shishya.confused")}
            </p>
          </div>
          <p className="text-3xl">{t("project.instructions")}</p>
          <TraceLines lines={trace.lines} selected={selected} onSelect={choose} disabled={pending} big />
          {selected !== null && (
            <form onSubmit={check} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-3xl font-bold">
                {t("project.typeFix")} ({t("teach.line", { n: selected })})
                <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="field math text-6xl min-h-24" />
              </label>
              <button type="submit" className="btn btn-primary text-3xl self-start min-h-20 px-10" disabled={pending || !typed.trim()}>
                {t("project.check")}
              </button>
            </form>
          )}
          {result && (
            <p role="status" className={`${result.ok ? "msg-good" : "msg-bad"} text-4xl`}>
              {result.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}
