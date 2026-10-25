import type { MessageKey } from "@/i18n";
import type { MasteryState } from "@/server/store";

// The plain words for a skill state, for t(). After a missed proof (NOT_YET) the words follow the class's
// setting for when the next try opens; without one, the default is tomorrow.

export function stateWord(state: MasteryState, cooldownHours?: number): [MessageKey, Record<string, number>?] {
  if (state !== "NOT_YET" || cooldownHours === undefined || cooldownHours === 24) return [`map.state.${state}`];
  if (cooldownHours === 0) return ["map.nextTry.0"];
  if (cooldownHours === 1) return ["map.nextTry.1"];
  return ["map.nextTry.hours", { h: cooldownHours }];
}
