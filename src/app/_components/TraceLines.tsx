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
    <ol className={big ? "nb nb-big" : "nb"}>
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
              className="nb-line w-full text-left"
            >
              <span className="nb-no">{t("teach.line", { n })}</span>
              {/* the equation keeps to one line and shrinks to fit */}
              <span className="nb-text">
                <Equation text={text} size={big ? "xl" : "md"} />
              </span>
            </ReadyButton>
          </li>
        );
      })}
    </ol>
  );
}
