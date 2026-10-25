// Makes typed maths the same whatever keyboard sent it, before any parser reads it. Pure, no dependency
// (an NFKC-style mapping written by hand for the characters children's keyboards really send):
//   every dash and minus sign → "-"
//   Devanagari digits ०–९ and full-width digits ０–９ → 0–9
//   full-width signs and letters (＝ ／ ＋ ｘ …) → their plain form; "X" → "x"
//   NBSP and other Unicode spaces → a normal space; zero-width characters are dropped
// "×" is left alone: it means multiply, never the variable x. "÷" is left alone too: only a final answer
// (parseAnswer) reads it, as "/".

const MINUSES = new Set(["−", "‐", "‑", "‒", "–", "—", "―", "﹣", "－"]);
const ZERO_WIDTH = new Set(["​", "‌", "‍", "⁠", "﻿"]);

const isUnicodeSpace = (code: number) =>
  code === 0x09 || code === 0x0a || code === 0x0d || code === 0xa0 || code === 0x1680 ||
  (code >= 0x2000 && code <= 0x200a) || code === 0x202f || code === 0x205f || code === 0x3000;

export function normaliseInput(text: string): string {
  let out = "";
  for (const ch of String(text ?? "")) {
    const code = ch.codePointAt(0)!;
    if (MINUSES.has(ch)) out += "-";
    else if (ZERO_WIDTH.has(ch)) continue;
    else if (isUnicodeSpace(code)) out += " ";
    else if (code >= 0x0966 && code <= 0x096f) out += String(code - 0x0966);
    else if (code >= 0xff01 && code <= 0xff5e) out += String.fromCharCode(code - 0xfee0);
    else out += ch;
  }
  return out.replace(/X/g, "x");
}
