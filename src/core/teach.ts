import { equivalent, fill, parseEquation, type MessageParams, type ParseErrorKey } from "./equation";
import { linearBothSides } from "./skills/linear-both-sides";
import { meetsTargetForm, type TraceLineNumber } from "./targetForm";
import type { Instance, Mistake } from "./types";

// "Teach the Shishya": did the child find the Shishya's first wrong line, and is their typed fix right?
// Feedback uses the NCERT textbook's language and never states the final answer. It comes in English (feedback)
// and as a message key for translation (feedbackKey, feedbackParams; see src/i18n).

/** English text for each teach message; src/i18n/en.ts reuses these. */
export const TEACH_MESSAGES = {
  "teach.fix.ok": "Well done! You found the Shishya's mistake and fixed it. Both sides are still equal.",
  "teach.fix.notEqual":
    "This line does not keep both sides equal to the question. Whatever you do to one side, do the same operation on the other side.",
  "teach.fix.shape.2":
    "Both sides are still equal, but there is still an x-term on the right side. Remove it by doing the same operation on both sides.",
  "teach.fix.shape.3": "Both sides are still equal. Now keep only x-terms on the left side and only numbers on the right side.",
  "teach.fix.shape.4": "Both sides are still equal. Now combine the x-terms into one term and the numbers into one number.",
  "teach.fix.shape.5": "Both sides are still equal. Now divide both sides by the number in front of x, so the left side is just x.",
  "teach.tap.tooEarly": "Line {line} is correct. Look further down for the first line where something goes wrong.",
  "teach.tap.tooLate": "Something already goes wrong before line {line}. Check the earlier lines one by one.",
} as const;
export type TeachMessageKey = keyof typeof TEACH_MESSAGES;

export type TeachResult = {
  lineCorrect: boolean;
  fixAccepted: boolean;
  feedback: string;
  feedbackKey: TeachMessageKey | ParseErrorKey;
  feedbackParams?: MessageParams;
};

const message = (key: TeachMessageKey, params?: MessageParams) => ({
  feedback: fill(TEACH_MESSAGES[key], params),
  feedbackKey: key,
  ...(params ? { feedbackParams: params } : {}),
});

/**
 * tappedLine and the mistake's firstWrongLine are 1-based. lineCorrect and fixAccepted are judged separately
 * (fixAccepted checks the typed line against the mistake's first wrong line); feedback talks about the tap first.
 * `mistakes` defaults to the authored ones; pass the skill's full list to include approved mined mistakes.
 */
export function checkTeachStep(
  instance: Instance,
  mistakeId: string,
  tappedLine: number,
  typedLine: string,
  mistakes: Mistake[] = linearBothSides.mistakes,
): TeachResult {
  const mistake = mistakes.find((m) => m.id === mistakeId);
  if (!mistake) throw new Error(`Unknown mistake id: ${mistakeId}`);
  const wrongLine = mistake.apply(instance).firstWrongLine as TraceLineNumber;

  const lineCorrect = tappedLine === wrongLine;
  const original = parseEquation(instance.text);
  const typed = parseEquation(typedLine);
  if (!original.ok) throw new Error(`Instance text does not parse: ${instance.text}`);

  let fixAccepted = false;
  let fix: Omit<TeachResult, "lineCorrect" | "fixAccepted">;
  if (!typed.ok) {
    fix = { feedback: typed.error, feedbackKey: typed.errorKey, ...(typed.errorParams ? { feedbackParams: typed.errorParams } : {}) };
  } else if (!equivalent(typed.equation, original.equation)) fix = message("teach.fix.notEqual");
  else if (!meetsTargetForm(typed.equation, wrongLine)) fix = message(`teach.fix.shape.${wrongLine}`);
  else {
    fixAccepted = true;
    fix = message("teach.fix.ok");
  }

  if (!lineCorrect) {
    const tap = message(tappedLine < wrongLine ? "teach.tap.tooEarly" : "teach.tap.tooLate", { line: tappedLine });
    return { lineCorrect, fixAccepted, ...tap };
  }
  return { lineCorrect, fixAccepted, ...fix };
}
