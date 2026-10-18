import type { CSSProperties } from "react";
import { EQ_CHAR_EM, EQ_MIN_PX } from "../_lib/equation-fit";

// One equation on ONE line, always. The font shrinks to fit the box (globals.css .eq), never below EQ_MIN_PX;
// if it still does not fit, the box scrolls sideways (last resort). Works in server and client components.

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
  const style = {
    "--eq-chars": Math.max(text.length, 1),
    "--eq-char-em": EQ_CHAR_EM,
    "--eq-min": `${EQ_MIN_PX}px`,
    "--eq-max": `${MAX_REM[size]}rem`,
  } as CSSProperties;
  return (
    <span className="eq-box">
      <span className={`eq math ${className}`} style={style}>
        {text}
      </span>
    </span>
  );
}
