import { en, type MessageKey } from "./en";
import { hi } from "./hi";

// t("key", { n: 3 }) → the child-facing string, with {placeholders} filled and {n|one|many} forms picked. English for now; Hindi is ready.

export type Lang = "en" | "hi";
export type { MessageKey } from "./en";

const tables: Record<Lang, Record<string, string>> = { en, hi };

/** Joins the parts of equations inside a sentence with non-breaking spaces, so a sentence never splits one. */
export const keepMathTogether = (text: string) => text.replace(/ ([+=−-]) /g, " $1 ");

/** {n|question|questions}: the first form when n is 1, the second otherwise (the same rule in English and Hindi). */
const plurals = (text: string, params?: Record<string, string | number>) =>
  text.replace(/\{(\w+)\|([^|{}]*)\|([^|{}]*)\}/g, (m, name: string, one: string, many: string) =>
    params && name in params ? (Number(params[name]) === 1 ? one : many) : m,
  );

export function t(key: MessageKey, params?: Record<string, string | number>, lang: Lang = "en"): string {
  const text = plurals(tables[lang][key] ?? en[key] ?? key, params);
  const filled = text.replace(/\{(\w+)\}/g, (m, name: string) => (params && name in params ? String(params[name]) : m));
  return keepMathTogether(filled);
}

/** False for text that has no translation key yet, e.g. a teacher-approved mined mistake's child label. */
export const hasMessage = (key: string, lang: Lang = "en") => key in tables[lang];

export const skillKey = (skillId: string, part: "title" | "example" | "task" | "answerLabel") => `skill.${skillId}.${part}` as const;
export const hintKey = (skillId: string, level: number) => `hint.${skillId}.${level as 1 | 2 | 3 | 4}` as const;
export const mistakeKey = (skillId: string, mistakeId: string) => `mistake.${skillId}.${mistakeId}` as const;
