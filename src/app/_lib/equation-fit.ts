// An equation must never wrap onto two lines: a child could read "−x + 6 = −10x" / "− 12" as two lines.
// <Equation> keeps it on one line and shrinks the font to fit (pure CSS, see globals.css .eq), never below
// EQ_MIN_PX; horizontal scroll is the last resort. These numbers are shared by the CSS and the tests.

/** Width of one character, in em, for the bold maths font: a slight over-estimate, so equations always fit. */
export const EQ_CHAR_EM = 0.62;
/** Smallest equation font, in px (the root font is 20px). */
export const EQ_MIN_PX = 18;

/** The font size (px) <Equation> uses for this text in a box this wide. */
export function fitFontPx(text: string, boxPx: number, minPx: number, maxPx: number): number {
  const fit = boxPx / (Math.max(text.length, 1) * EQ_CHAR_EM);
  return Math.min(maxPx, Math.max(minPx, fit));
}

/** Equations inside sentences: t() applies this to all child-facing text. */
export { keepMathTogether } from "../../i18n";
