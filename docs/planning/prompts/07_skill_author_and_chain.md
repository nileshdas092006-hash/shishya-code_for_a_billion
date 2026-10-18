Task 7: the Skill Author agent, then use it to create skills 1–4 of the chain. Needs ANTHROPIC_API_KEY (same rules as Task 6).
Read CLAUDE.md first. Work autonomously.

A. Agent (src/agents/author.ts, run with `npm run author -- <skillId> "<one-line description>"`):
 - It writes a new skill file in src/core/skills/<name>.ts following the exact same SkillSpec shape as linear-both-sides.ts,
   plus its tests, on a new git branch named author/<skillId>.
 - Its tools are limited to: read files under src/core, write files only under src/core/skills and src/core/__tests__,
   and run `npm test`. No other shell commands, no network.
 - It must keep going until npm test passes (max 20 turns), then stop and print a review checklist for Das.
 - It logs runs to data/agent-runs.jsonl like the Miner and respects the same $25 cap.
B. Use it to create, one at a time (each on its own branch, then merged after tests pass):
 1. alg.integers.ops: add and subtract negative integers, e.g. −7 + 3, 5 − (−4). Mistakes: ignores the sign, treats minus a
    negative as minus, subtracts the smaller from the larger and keeps the sign of the first.
 2. alg.like-terms: simplify like 3x + 5 − x + 2 to 2x + 7. Mistakes: adds x-terms and numbers together, drops the sign of a
    term, treats x as 0x.
 3. alg.linear.one-step: x + 7 = 3, 4x = −12, x − 5 = −2. Mistakes: does the same operation instead of the opposite one,
    divides the wrong way, sign error with negatives.
 4. alg.linear.two-step: 5x − 3 = −8. Mistakes: divides before removing the constant, kept-const-sign, forgot-to-divide.
 Prerequisites: 1 → 2 → 3 → 4 → alg.linear.both-sides. Give each skill a 4-level hint ladder in NCERT language, a teach
 rule and a proof rule (for skills 1–2 the "apply" item can be a simple story problem).
C. For each merged skill write a 10-line plain-English review note in docs/skills/<skillId>.md: what the generator makes,
   each mistake with one worked example, and anything Das must check by hand.
Commit, update BUILD_LOG.md, and explain in plain English how the Skill Author works and how its output is checked.
