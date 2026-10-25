import { fill, type MessageParams, type ParseErrorKey } from "./equation";
import { LINE_MESSAGES } from "./lineCheck";
import { teachLineReceipt, type LineReceipt } from "./receipt";
import { getSkillEntry } from "./skills";
import type { Instance, Mistake } from "./types";

// "Teach the Shishya": did the child find the Shishya's first wrong line, and is their typed fix right?
// Each skill decides what a correct line looks like (SkillSpec.checkLine). Feedback uses the NCERT textbook's
// language and never states the final answer. It comes in English (feedback) and as a message key for
// translation (feedbackKey, feedbackParams; see src/i18n).

/** English text for each teach message; src/i18n/en.ts reuses these. */
export const TEACH_MESSAGES = {
  ...LINE_MESSAGES,
  "teach.tap.tooEarly": "Line {line} is correct. Look further down for the first line where something goes wrong.",
  "teach.tap.tooLate": "Something already goes wrong before line {line}. Check the earlier lines one by one.",
} as const;
export type TeachMessageKey = keyof typeof TEACH_MESSAGES;

export type TeachResult = {
  lineCorrect: boolean;
  fixAccepted: boolean;
  feedback: string;
  feedbackKey: TeachMessageKey | ParseErrorKey | string;
  feedbackParams?: MessageParams;
  /** How the typed line was checked (same solution or value as the line above); null unless the right line was tapped. */
  receipt: LineReceipt | null;
};

/**
 * tappedLine and the mistake's firstWrongLine are 1-based. lineCorrect and fixAccepted are judged separately
 * (fixAccepted checks the typed line against the mistake's first wrong line); feedback talks about the tap first.
 * `mistakes` defaults to the skill's authored ones; pass the full list to include approved mined mistakes.
 */
export function checkTeachStep(
  instance: Instance,
  mistakeId: string,
  tappedLine: number,
  typedLine: string,
  mistakes?: Mistake[],
): TeachResult {
  const skill = getSkillEntry(instance.skillId)?.spec;
  if (!skill) throw new Error(`Unknown skill: ${instance.skillId}`);
  const mistake = (mistakes ?? skill.mistakes).find((m) => m.id === mistakeId);
  if (!mistake) throw new Error(`Unknown mistake id: ${mistakeId}`);
  const wrongLine = mistake.apply(instance).firstWrongLine;

  const lineCorrect = tappedLine === wrongLine;
  const check = skill.checkLine(instance, wrongLine, typedLine);
  const fix = { feedback: check.feedback, feedbackKey: check.feedbackKey, ...(check.feedbackParams ? { feedbackParams: check.feedbackParams } : {}) };

  if (!lineCorrect) {
    const key = tappedLine < wrongLine ? "teach.tap.tooEarly" : "teach.tap.tooLate";
    const params = { line: tappedLine };
    return { lineCorrect, fixAccepted: check.ok, feedback: fill(TEACH_MESSAGES[key], params), feedbackKey: key, feedbackParams: params, receipt: null };
  }
  return { lineCorrect, fixAccepted: check.ok, ...fix, receipt: teachLineReceipt(instance, mistake, typedLine) };
}
