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

/** The longest line that fits the narrowest box on a 360px phone at the minimum size (see equation-fit.test.ts). */
const PHONE_MAX_CHARS = 21;

/** What to show for a line: a product line too long for a phone closes up the spaces round ×. Other lines stay as they are. */
export const fitText = (text: string) => (text.length > PHONE_MAX_CHARS ? text.replace(/ × /g, "×") : text);

/** The rows of a 2×2 matrix written [[3, −2], [4, 5]], or null if this text is not one. */
export function matrixRows(text: string): [[string, string], [string, string]] | null {
  const m = /^\[\[([^,\]]+), ([^,\]]+)\], \[([^,\]]+), ([^,\]]+)\]\]$/.exec(text);
  return m ? [[m[1], m[2]], [m[3], m[4]]] : null;
}

/** Words, not maths: a question that is a sentence (a dice question) wraps like any sentence. */
export const isSentence = (text: string) => /[a-z]{2,} [a-z]{2,}/i.test(text);

/** Equations inside sentences: t() applies this to all child-facing text. */
export { keepMathTogether } from "../../i18n";
