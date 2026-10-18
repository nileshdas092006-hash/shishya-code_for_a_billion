import { equivalent, parseEquation } from "./equation";
import { linearBothSides } from "./skills/linear-both-sides";
import { meetsTargetForm, type TraceLineNumber } from "./targetForm";
import type { Instance } from "./types";

// "Teach the Shishya": did the child find the Shishya's first wrong line, and is their typed fix right?
// Feedback uses the NCERT textbook's language and never states the final answer.

export type TeachResult = { lineCorrect: boolean; fixAccepted: boolean; feedback: string };

const SHAPE_FEEDBACK: Record<TraceLineNumber, string> = {
  2: "Both sides are still equal, but there is still an x-term on the right side. Remove it by doing the same operation on both sides.",
  3: "Both sides are still equal. Now keep only x-terms on the left side and only numbers on the right side.",
  4: "Both sides are still equal. Now combine the x-terms into one term and the numbers into one number.",
  5: "Both sides are still equal. Now divide both sides by the number in front of x, so the left side is just x.",
};

const NOT_EQUAL =
  "This line does not keep both sides equal to the question. Whatever you do to one side, do the same operation on the other side.";
const WELL_DONE = "Well done! You found the Shishya's mistake and fixed it. Both sides are still equal.";

/**
 * tappedLine and the mistake's firstWrongLine are 1-based. lineCorrect and fixAccepted are judged separately
 * (fixAccepted checks the typed line against the mistake's first wrong line); feedback talks about the tap first.
 */
export function checkTeachStep(
  instance: Instance,
  mistakeId: string,
  tappedLine: number,
  typedLine: string,
): TeachResult {
  const mistake = linearBothSides.mistakes.find((m) => m.id === mistakeId);
  if (!mistake) throw new Error(`Unknown mistake id: ${mistakeId}`);
  const wrongLine = mistake.apply(instance).firstWrongLine as TraceLineNumber;

  const lineCorrect = tappedLine === wrongLine;
  const original = parseEquation(instance.text);
  const typed = parseEquation(typedLine);
  if (!original.ok) throw new Error(`Instance text does not parse: ${instance.text}`);

  let fixAccepted = false;
  let fixFeedback: string;
  if (!typed.ok) fixFeedback = typed.error;
  else if (!equivalent(typed.equation, original.equation)) fixFeedback = NOT_EQUAL;
  else if (!meetsTargetForm(typed.equation, wrongLine)) fixFeedback = SHAPE_FEEDBACK[wrongLine];
  else {
    fixAccepted = true;
    fixFeedback = WELL_DONE;
  }

  if (!lineCorrect) {
    const feedback =
      tappedLine < wrongLine
        ? `Line ${tappedLine} is correct. Look further down for the first line where something goes wrong.`
        : `Something already goes wrong before line ${tappedLine}. Check the earlier lines one by one.`;
    return { lineCorrect, fixAccepted, feedback };
  }
  return { lineCorrect, fixAccepted, feedback: fixFeedback };
}
