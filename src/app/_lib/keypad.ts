// The keys of the on-screen maths keypad, and what one tap does to the answer box (pure, so it is tested
// without a browser). Signs are typed as plain ASCII ("-", not "−"): every parser reads them.

export type KeypadKey =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "minus" | "x" | "plus" | "equals" | "divide" | "delete" | "clear";

/** In screen order: 7 8 9 / 4 5 6 / 1 2 3 / − 0 x / + = / / ⌫ Clear. */
export const KEYPAD_KEYS: readonly KeypadKey[] = [
  "7", "8", "9",
  "4", "5", "6",
  "1", "2", "3",
  "minus", "0", "x",
  "plus", "equals", "divide",
  "delete", "clear",
];

const TYPES: Partial<Record<KeypadKey, string>> = { minus: "-", x: "x", plus: "+", equals: "=", divide: "/" };

/** The answer box after one tap, with the selection from..to (the cursor when they are equal). */
export function applyKey(value: string, from: number, to: number, key: KeypadKey): { value: string; cursor: number } {
  const start = Math.max(0, Math.min(from, to, value.length));
  const end = Math.min(value.length, Math.max(from, to));
  if (key === "clear") return { value: "", cursor: 0 };
  if (key === "delete") {
    if (start !== end) return { value: value.slice(0, start) + value.slice(end), cursor: start };
    if (start === 0) return { value, cursor: 0 };
    return { value: value.slice(0, start - 1) + value.slice(start), cursor: start - 1 };
  }
  const text = TYPES[key] ?? key;
  return { value: value.slice(0, start) + text + value.slice(end), cursor: start + text.length };
}
