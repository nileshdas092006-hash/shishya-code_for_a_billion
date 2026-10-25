"use client";

import { useEffect, useRef } from "react";
import type { AnswerReceipt, LineReceipt } from "@/core/receipt";
import { t } from "@/i18n";
import { Equation } from "./Equation";

// "How we checked": the receipt under a verdict, worked out by src/core/receipt.ts (code decides, not AI).
// A plain <details> toggle, so it needs no JavaScript to open. Collapsed on phones, open on a wide screen;
// the projector passes `open`. `line` is the number of the line above a typed Teach line.

type Props = { receipt: AnswerReceipt | LineReceipt; line?: number; open?: boolean; big?: boolean };
type Size = "md" | "xl";

function Worked({ label, value, size }: { label?: string; value: string; size: Size }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="font-semibold">{label}</span>}
      <Equation text={value} size={size} />
    </div>
  );
}

function Verdict({ holds, children }: { holds: boolean; children: string }) {
  return <p className={`font-bold ${holds ? "text-green-800" : "text-amber-900"}`}>{children}</p>;
}

export function Receipt({ receipt, line = 1, open = false, big = false }: Props) {
  const box = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!open && box.current && window.matchMedia("(min-width: 768px)").matches) box.current.open = true;
  }, [open]);
  const size: Size = big ? "xl" : "md";
  const text = big ? "text-3xl" : "text-lg";

  function body() {
    const r = receipt;
    switch (r.kind) {
      case "substitute":
        return (
          <>
            <p>{t("receipt.putBack", { x: r.x })}</p>
            <Worked label={t("receipt.left")} value={r.left} size={size} />
            <Worked label={t("receipt.right")} value={r.right} size={size} />
            <Verdict holds={r.holds}>
              {r.holds ? t("receipt.holds", { value: r.leftValue }) : t("receipt.notHolds", { left: r.leftValue, right: r.rightValue })}
            </Verdict>
          </>
        );
      case "integer":
        return (
          <>
            <p>{t(`receipt.rule.${r.rule}`)}</p>
            <p>{t("receipt.integer.answer", { expr: r.expr, value: r.value })}</p>
            <Worked label={t("receipt.integer.check")} value={r.check} size={size} />
            <Verdict holds={r.holds}>
              {r.holds ? t("receipt.integer.holds", { start: r.start }) : t("receipt.integer.notHolds", { back: r.back, start: r.start })}
            </Verdict>
          </>
        );
      case "collect":
        return (
          <>
            <Worked label={t("receipt.collect.x")} value={r.xTerms} size={size} />
            <Worked label={t("receipt.collect.numbers")} value={r.numbers} size={size} />
            <Verdict holds>{t("receipt.collect.result", { result: r.result })}</Verdict>
          </>
        );
      case "compare":
        return (
          <>
            <p>{t("receipt.compare.putIn", { x: r.x })}</p>
            <Worked label={t("receipt.compare.question")} value={r.question} size={size} />
            <Worked label={t("receipt.compare.answer")} value={r.answer} size={size} />
            <Verdict holds={r.holds}>
              {r.holds ? t("receipt.compare.holds", { value: r.questionValue }) : t("receipt.compare.notHolds", { q: r.questionValue, a: r.answerValue })}
            </Verdict>
          </>
        );
      case "line":
        if ("sameSolution" in r) {
          if (!r.check || !r.solution) return <Verdict holds={false}>{t("receipt.line.noSolution", { n: line })}</Verdict>;
          return (
            <>
              <p>{t("receipt.line.solution", { solution: r.solution, x: r.check.x, n: line })}</p>
              <Worked label={t("receipt.left")} value={r.check.left} size={size} />
              <Worked label={t("receipt.right")} value={r.check.right} size={size} />
              <Verdict holds={r.sameSolution}>
                {r.sameSolution
                  ? t("receipt.line.same", { value: r.check.leftValue, n: line })
                  : t("receipt.line.notSame", { left: r.check.leftValue, right: r.check.rightValue, n: line })}
              </Verdict>
            </>
          );
        }
        if (!r.check) {
          return (
            <Verdict holds={r.sameValue}>
              {r.sameValue ? t("receipt.line.sumSame", { value: r.value ?? "", n: line }) : t("receipt.line.sumNotSame", { n: line })}
            </Verdict>
          );
        }
        return (
          <>
            <p>{t("receipt.line.putIn", { x: r.check.x, n: line })}</p>
            <Worked label={t("receipt.line.above", { n: line })} value={r.check.above} size={size} />
            <Worked label={t("receipt.line.yours")} value={r.check.line} size={size} />
            <Verdict holds={r.sameValue}>
              {r.sameValue
                ? t("receipt.line.sameValue", { value: r.check.aboveValue, n: line })
                : t("receipt.line.notSameValue", { above: r.check.aboveValue, line: r.check.lineValue, n: line })}
            </Verdict>
          </>
        );
    }
  }

  return (
    <details ref={box} open={open || undefined} className={`card ${text}`}>
      <summary className="cursor-pointer font-bold py-2">{t("receipt.title")}</summary>
      <div className="flex flex-col gap-3 mt-3 min-w-0">{body()}</div>
    </details>
  );
}
