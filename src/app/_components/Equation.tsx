import type { CSSProperties } from "react";
import { EQ_CHAR_EM, EQ_MIN_PX, fitText, isSentence, matrixRows } from "../_lib/equation-fit";

// One equation on ONE line, always. The font shrinks to fit the box (globals.css .eq), never below EQ_MIN_PX;
// if it still does not fit, the box scrolls sideways (last resort). Works in server and client components.
// A college question (F12) is shown as what it is: a 2×2 matrix in two rows between the determinant's bars, or a
// sentence that wraps.

const MAX_REM = { sm: 1.25, md: 1.875, lg: 2.25, xl: 3.75 } as const;

export function Equation({
  text,
  size = "lg",
  className = "",
}: {
  text: string;
  size?: keyof typeof MAX_REM;
  className?: string;
}) {
  const rows = matrixRows(text);
  if (rows) {
    return (
      <span
        role="img"
        aria-label={text}
        style={{ fontSize: `${MAX_REM[size]}rem` }}
        className={`math inline-grid grid-cols-2 gap-x-4 border-x-4 border-current px-3 text-right font-bold leading-snug ${className}`}
      >
        {rows.flat().map((cell, i) => (
          <span key={i}>{cell}</span>
        ))}
      </span>
    );
  }
  if (isSentence(text)) return <span className={`block math font-bold break-words ${size === "xl" ? "text-3xl" : "text-xl"} ${className}`}>{text}</span>;
  const shown = fitText(text);
  const style = {
    "--eq-chars": Math.max(shown.length, 1),
    "--eq-char-em": EQ_CHAR_EM,
    "--eq-min": `${EQ_MIN_PX}px`,
    "--eq-max": `${MAX_REM[size]}rem`,
  } as CSSProperties;
  return (
    <span className="eq-box">
      <span className={`eq math ${className}`} style={style}>
        {shown}
      </span>
    </span>
  );
}
