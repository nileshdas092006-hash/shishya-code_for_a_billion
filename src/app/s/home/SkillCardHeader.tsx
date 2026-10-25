import { skillKey, t } from "@/i18n";
import type { MasteryState } from "@/server/store";
import { Equation } from "../../_components/Equation";
import { StateIcon } from "../../_components/StateIcon";
import { stateWord } from "../../_lib/state-words";

// The top of a skill card: icon, title, example and the state word. On a phone the state word gets its own
// line, and the example (which never wraps) shrinks to fit the card, so the page never scrolls sideways.
// cooldownHours is the class's wait after a missed proof, so the state word says when the next try opens.

export function SkillCardHeader({ skillId, state, cooldownHours }: { skillId: string; state: MasteryState; cooldownHours?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <StateIcon state={state} />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-2xl font-bold">{t(skillKey(skillId, "title"))}</span>
        <span className="text-gray-700">
          <Equation text={t(skillKey(skillId, "example"))} size="sm" />
        </span>
      </div>
      <span className="w-full sm:w-auto sm:ml-auto text-lg font-bold">{t(...stateWord(state, cooldownHours))}</span>
    </div>
  );
}
