"use client";

import { t } from "@/i18n";

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
            <button
              type="button"
              onClick={() => onSelect(n)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`w-full text-left flex items-center gap-4 rounded-xl border-4 px-4 ${big ? "py-4" : "py-2"} ${
                isSelected ? "border-amber-500 bg-amber-50" : "border-gray-300 bg-white hover:border-blue-700"
              }`}
            >
              <span className={`font-bold text-gray-700 ${big ? "text-3xl" : "text-lg"} min-w-[5.5rem]`}>
                {t("teach.line", { n })}
              </span>
              <span className={`math font-bold ${big ? "text-6xl" : "text-3xl"}`}>{text}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
