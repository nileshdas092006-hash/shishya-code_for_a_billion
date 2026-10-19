"use client";

import { t } from "@/i18n";
import { Equation } from "./Equation";
import { ReadyButton } from "./ReadyButton";

// The Shishya's working, one tappable line each (mouse, touch or keyboard).

export function TraceLines({
  lines,
  selected,
  onSelect,
  disabled,
  big = false,
}: {
  lines: string[];
  selected: number | null;
  onSelect: (line: number) => void;
  disabled?: boolean;
  big?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-2">
      {lines.map((text, i) => {
        const n = i + 1;
        const isSelected = selected === n;
        return (
          <li key={n}>
            <ReadyButton
              type="button"
              onClick={() => onSelect(n)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`w-full text-left flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 rounded-xl border-4 px-3 sm:px-4 ${
                big ? "py-4" : "py-2"
              } ${isSelected ? "border-amber-500 bg-amber-50" : "border-gray-300 bg-white hover:border-blue-700"}`}
            >
              <span className={`shrink-0 font-bold text-gray-700 ${big ? "text-3xl" : "text-lg"} sm:min-w-[5.5rem]`}>
                {t("teach.line", { n })}
              </span>
              {/* the equation keeps to one line and shrinks to fit (on a phone the "Line n" label sits above it) */}
              <span className="flex-1 min-w-0 w-full">
                <Equation text={text} size={big ? "xl" : "md"} />
              </span>
            </ReadyButton>
          </li>
        );
      })}
    </ol>
  );
}
