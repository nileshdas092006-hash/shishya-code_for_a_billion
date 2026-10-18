import { en, type MessageKey } from "./en";
import { hi } from "./hi";

// t("key", { n: 3 }) → the child-facing string, with {placeholders} filled. English for now; Hindi is ready.

export type Lang = "en" | "hi";
export type { MessageKey } from "./en";

const tables: Record<Lang, Record<string, string>> = { en, hi };

export function t(key: MessageKey, params?: Record<string, string | number>, lang: Lang = "en"): string {
  const text = tables[lang][key] ?? en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (params && name in params ? String(params[name]) : m));
}

export const skillKey = (skillId: string, part: "title" | "example") => `skill.${skillId}.${part}` as const;
export const hintKey = (skillId: string, level: number) => `hint.${skillId}.${level as 1 | 2 | 3 | 4}` as const;
export const mistakeKey = (skillId: string, mistakeId: string) => `mistake.${skillId}.${mistakeId}` as const;
