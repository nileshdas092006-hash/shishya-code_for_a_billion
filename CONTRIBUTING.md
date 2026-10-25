# Contributing to Shishya

Thank you for helping. Shishya is used by children, so a few rules are strict. Read them before you change anything.

## Rules every contribution keeps

These come from [CLAUDE.md](CLAUDE.md). A pull request that breaks one is not merged.

1. **No names, ever.** Children are only random codes like `8B-R4TX`. Never store children's names, phone numbers,
   photos, camera, microphone, location or chat transcripts. Children under 13 (Class 7) never see an AI chat.
   See [PRIVACY.md](PRIVACY.md).
2. **NCERT language for children.** Every word a child sees follows the NCERT textbook: "do the same operation on
   both sides", never "move it" or "change the sign". A test fails if English screen text uses "move" or
   "change the sign".
3. **Only `src/server/mastery.ts` writes mastery.** No other file may change a child's state on a skill.
4. **No AI in any check.** Correct answers, mistake answers and every check come only from `src/core`, never from a
   model. An AI may only *propose* (a mistake as data, or a draft skill on a branch); code tests it and a person
   approves it. AI output never changes a child's mastery.
5. **`src/core` is pure.** No I/O, no network, no database, no React or Next.js, no `Math.random` or `Date.now`.
   Randomness comes only from the seeded `Rng` passed in. ESLint enforces this.
6. **Tests first.** Write a failing test before every change to `src/core`.
7. **Every screen word in English and Hindi.** Add each new on-screen line to both `src/i18n/en.ts` and
   `src/i18n/hi.ts`. Mark a Hindi line you are unsure of with `// HINDI-REVIEW`.
8. **No new dependency** without asking the maintainer first and explaining why (see [MAINTAINERS.md](MAINTAINERS.md)).
9. **Database changes are additive** (`ALTER TABLE … ADD COLUMN … DEFAULT …` or `CREATE TABLE IF NOT EXISTS`, in the
   migration code in `src/server/store.ts`). Never drop or rename a column that holds data.
10. **Phones first.** Pages must work at 360 px wide with no sideways scroll.

## Before you open a pull request

```bash
npm test          # all tests, including the property tests
npm run lint      # ESLint, including the rule that keeps src/core pure
npx tsc --noEmit  # type check
npm run build     # production build
```

All four must pass. Keep files LF (the repository's `.gitattributes` does this).

## How to add a skill

A skill is one `SkillSpec` object in `src/core/skills`. The full format, field by field, is in
[docs/SKILL_SPEC.md](docs/SKILL_SPEC.md). Copy a finished skill as your model: `linear-two-step.ts` for equations,
`integers-ops.ts` for sums, `like-terms.ts` for expressions.

1. **Write the test file first**, `src/core/__tests__/<your-skill>.test.ts`:
   - check two or three worked examples exactly: the question text, the correct working line by line, the answer,
     and for each mistake its wrong working, its answer and its first wrong line;
   - check the generator's rules (the ranges of the numbers);
   - call `describeSkillProperties(getSkillEntry("<your id>")!, …)` from `./skill-properties`. This runs the
     property tests over **1,000 random questions** for the skill and for **every mistake**: a mistake never gives
     the correct answer, the mistakes' answers all differ, each first wrong line is right, the line checker accepts
     every correct line and rejects each mistake's first wrong line, `diagnose()` names each mistake from its answer,
     word problems are valid, and hints and child labels use NCERT words and never give away the answer.

   Run `npm test` and see it fail.
2. **Write the skill file**, `src/core/skills/<your-skill>.ts`. It exports the `SkillSpec` and a word-problem
   generator `(rng) => ApplyItem` (an everyday Indian story, in English `text` and Hindi `textHi`). Reuse
   `src/core/skills/helpers.ts` (`nonZero`, `num`, `toTrace`, `mistakesAreSound`) and the line checkers in
   `src/core/lineCheck.ts` (`checkArithLine`, `checkExpressionLine`, `checkEquationLine`). Use exact fractions from
   `src/core/fraction.ts`.
3. **Make sure `mistakesAreSound` holds.** In `generate()`, keep trying new numbers (with the same `rng`) until
   `mistakesAreSound(instance, mistakes)` is true: at least one mistake applies, and the correct answer and the
   answers of all the mistakes that apply are different. That way a wrong answer points to at most one mistake.
   Throw after a fixed number of tries, so a bad generator fails loudly.
4. **Register it** in `src/core/skills/index.ts`: add `{ spec, generateApply }` to `SKILLS`, in teaching order.
   Its `prerequisites` must name skills that come before it. Screens and the server read skills only from this list.
5. **Add its words** to `src/i18n/en.ts` and `src/i18n/hi.ts`: `skill.<id>.title`, `.example`, `.task`,
   `.answerLabel`, the 4 hints `hint.<id>.1…4` and a child label `mistake.<id>.<mistakeId>` for every mistake. The
   English text must be exactly the same as `hintLadder` and each `childLabel` (a test checks this).
6. **Write a short note** in `docs/skills/<id>.md` like the others: the questions it makes, the working, each
   mistake with an example, and what a teacher should check by hand.
7. **Run `npm test`** until everything passes, then lint, type check and build.

If you later change a skill's `generate()`, `solve()` or mistakes, raise its `version`. Stored questions are rebuilt
from their seeds, and teach sessions and proofs only count on the current version.

The Skill Author agent (`npm run author`) can draft steps 1 and 2 for you on a separate branch. A person still
reviews the draft, does steps 4 to 6 and merges it.

## Mistakes found by the Misconception Miner

A mistake proposed by the Miner is **data, never code**: a small JSON object checked by `validateMinedMistake` in
`src/core/minedMistake.ts` and approved by a teacher. Its format is in [docs/SKILL_SPEC.md](docs/SKILL_SPEC.md#mined-mistakes-json).
Children never see the AI's words: they see a fixed, human-written message for the mistake's step type, or the
teacher's own words.

## Reporting a problem

See [MAINTAINERS.md](MAINTAINERS.md). Never put a child's code, a class code or a PIN in an issue.
