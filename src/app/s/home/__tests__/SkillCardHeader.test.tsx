import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SKILLS } from "@/core/skills";
import { skillKey, t } from "@/i18n";
import { SkillCardHeader } from "../SkillCardHeader";

// Found by the live 360px check: "like 3x + 5 − x + 2 = 2x + 7" never wraps (by design), so the state word
// next to it ("Locked", now "Not started") was pushed past the right edge and the whole page scrolled sideways.

describe("a skill card's header on the skill map, at phone width", () => {
  const html = renderToStaticMarkup(<SkillCardHeader skillId="alg.like-terms" state="LOCKED" />);

  it("puts the state word on its own line on a phone, and at the right on a wider screen", () => {
    expect(html).toMatch(/<span class="[^"]*\bw-full\b[^"]*\bsm:w-auto\b[^"]*\bsm:ml-auto\b[^"]*">Not started<\/span>/);
  });

  it("shows the example with <Equation>: one line, shrinking to fit the card instead of pushing the page wider", () => {
    expect(html).toContain('class="eq-box"');
    expect(html).toContain(t(skillKey("alg.like-terms", "example")));
    expect(html).toMatch(/<div class="[^"]*\bmin-w-0\b[^"]*\bflex-1\b/); // the text column may shrink
  });

  it("works for every skill and state", () => {
    for (const { spec } of SKILLS) {
      for (const state of ["LOCKED", "OPEN", "KEY1", "NOT_YET", "MASTERED"] as const) {
        const out = renderToStaticMarkup(<SkillCardHeader skillId={spec.id} state={state} />);
        expect(out).toContain(t(skillKey(spec.id, "title")));
        expect(out).toContain(t(`map.state.${state}`));
      }
    }
  });
});
