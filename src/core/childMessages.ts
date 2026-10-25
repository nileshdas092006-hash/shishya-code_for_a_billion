import type { StepType } from "./types";

// What a child sees for a MINED mistake: a fixed, human-written message per step type, never the AI's words.
// NCERT language ("do the same operation on both sides"; never "move" or "change the sign"). Code fills in the
// numbers: {line} is the first wrong line, {prev} the line above it. A teacher may write their own wording when
// approving a mined mistake; then that is shown instead (see toMistake in minedMistake.ts).

export type ChildMessageKey = `child.step.${StepType}`;
export const childMessageKey = (stepType: StepType): ChildMessageKey => `child.step.${stepType}`;

export const CHILD_MESSAGES_EN: Record<ChildMessageKey, string> = {
  "child.step.move-x":
    "Look again at line {line}. To get the x-terms on one side, do the same operation on both sides: subtract the same x-term from both sides.",
  "child.step.move-const":
    "Look again at line {line}. To get the numbers on the other side, do the same operation on both sides: add or subtract the same number on both sides.",
  "child.step.simplify":
    "Look again at line {line}. Work out each side of line {prev} carefully: add or subtract the like terms, and keep each sign with its number.",
  "child.step.divide":
    "Look again at line {line}. Divide both sides by the number in front of x in line {prev}, the line just above.",
  "child.step.sign": "Look again at line {line}. Check the sign of each number, and use the rules for adding and subtracting integers.",
  "child.step.operation": "Look again at line {line}. Check which operation the question asks for, and do that operation.",
};

// HINDI-REVIEW (all six lines)
export const CHILD_MESSAGES_HI: Record<ChildMessageKey, string> = {
  "child.step.move-x":
    "पंक्ति {line} फिर से देखो। x वाले पदों को एक पक्ष में लाने के लिए दोनों पक्षों पर एक ही संक्रिया करो: दोनों पक्षों में से वही x वाला पद घटाओ।",
  "child.step.move-const":
    "पंक्ति {line} फिर से देखो। संख्याओं को दूसरे पक्ष में लाने के लिए दोनों पक्षों पर एक ही संक्रिया करो: दोनों पक्षों में वही संख्या जोड़ो या घटाओ।",
  "child.step.simplify":
    "पंक्ति {line} फिर से देखो। पंक्ति {prev} के हर पक्ष को ध्यान से हल करो: समान पदों को जोड़ो या घटाओ, और हर संख्या का चिह्न उसके साथ रखो।",
  "child.step.divide": "पंक्ति {line} फिर से देखो। दोनों पक्षों को पंक्ति {prev} (ठीक ऊपर वाली पंक्ति) में x के साथ वाली संख्या से भाग दो।",
  "child.step.sign": "पंक्ति {line} फिर से देखो। हर संख्या का चिह्न जाँचो, और पूर्णांकों को जोड़ने और घटाने के नियम लगाओ।",
  "child.step.operation": "पंक्ति {line} फिर से देखो। देखो कि प्रश्न कौन-सी संक्रिया करने को कहता है, और वही संक्रिया करो।",
};

/** The numbers code fills in for a mistake that first goes wrong at line `line`. */
export const childMessageParams = (line: number) => ({ line, prev: line - 1 });

/** The fixed message for a step type, with the line numbers filled in. */
export function childMessage(stepType: StepType, line: number, lang: "en" | "hi" = "en"): string {
  const text = (lang === "hi" ? CHILD_MESSAGES_HI : CHILD_MESSAGES_EN)[childMessageKey(stepType)];
  const params: Record<string, number> = childMessageParams(line);
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}
