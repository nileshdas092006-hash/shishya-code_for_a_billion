Task 7: skills 1–4 of the chain, plus the Skill Author agent. Read CLAUDE.md first. Work autonomously. Tests first.

A. Skills (each in src/core/skills/<name>.ts, same SkillSpec shape and same property-test standard as linear-both-sides):
 1. alg.integers.ops: add/subtract negative integers (−7 + 3, 5 − (−4)). Mistakes: ignores the sign; treats minus a negative
    as minus; subtracts the smaller from the larger and keeps the sign of the first.
 2. alg.like-terms: 3x + 5 − x + 2 → 2x + 7. Mistakes: adds x-terms and numbers together; drops a term's sign; treats x as 0x.
 3. alg.linear.one-step: x + 7 = 3, 4x = −12, x − 5 = −2. Mistakes: same operation instead of the opposite; divides the wrong
    way; sign error with negatives.
 4. alg.linear.two-step: 5x − 3 = −8. Mistakes: divides before removing the constant; kept-const-sign; forgot-to-divide.
 Prerequisites: 1 → 2 → 3 → 4 → alg.linear.both-sides. 4-level hint ladders in NCERT language; teach and proof rules
 (apply items: simple Indian-context story problems). Teach/checker support for each answer type (a number, an expression
 like 2x + 7, or an equation). Screens must show all 5 skills on the skill map.
B. Skill Author agent (src/agents/author.ts, `npm run author -- <skillId> "<description>"`), using the free AI client and loop
   from Task 6: it drafts a new skill file + tests on a new git branch author/<skillId>, may only write under src/core/skills
   and src/core/__tests__, may only run npm test, stops when tests pass (max 20 turns) and prints a review checklist.
   Respect the daily cap. If a real key exists, try it on ONE extra small skill and report honestly whether the free model
   managed it; if it fails, that is fine: say so in BUILD_LOG.md. Never merge its branch automatically.
C. For each of skills 1–4 write docs/skills/<skillId>.md (10 plain-English lines: what it generates, each mistake with one
   worked example, anything Das should check by hand).
Run npm test, lint, build; commit; update BUILD_LOG.md (state clearly which skills were written by Claude Code in AgentFoundry
and which by the Skill Author agent); explain in plain English how a new skill is checked before children see it.
