# Build log

## 2026-10-18: Task 1, project setup
- What was done: created the Next.js app (TypeScript, App Router, ESLint, Tailwind, `src/` directory, npm); added Vitest with an `npm test` script and one trivial passing test; added the project rules, the core README, an MIT licence and a README; ran `npm test` and `npm run build` (both pass); ran `git init` and made the first commit. No Shishya features yet.
- Note: `@types/node` was raised from `^20` to `^24` (matches the installed Node v24) because Vitest 5 requires `@types/node` 22 or newer.
- Files: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore`, `AGENTS.md`, `src/app/*`, `public/*`, `vitest.config.mts`, `src/core/sanity.test.ts`, `src/core/README.md`, `CLAUDE.md`, `BUILD_LOG.md`, `LICENSE`, `README.md`.
- Built in AgentFoundry with Claude Code.

## 2026-10-18: Task 2, maths core for "variables on both sides" (alg.linear.both-sides 1.0.0)
- What was done: wrote the tests first (they failed because the code did not exist yet), then built the maths core until all tests passed. Exact fractions; a seeded random generator (mulberry32); the skill types; the skill itself (question generator with all the rules, a 5-line correct solution, 4 authored mistake functions, a 4-level hint ladder in NCERT language); and diagnose(), which names the ONE mistake behind a wrong answer or says "unknown". "Divides by the original coefficient a" was left out on purpose so the Misconception Miner can find it later.
- Tests: 33 passing, including property tests over 1,000 seeds (generator rules, answer checks out, no mistake gives the correct answer, mistake answers all different, first wrong line correct, same seed = same question, diagnose names the right mistake, unknown answers give "unknown", hints never contain the answer). Measured: the generator needs about 12 tries on average (max 116 over 20,000 seeds), well under the 1,000 limit.
- Also: an ESLint rule that stops src/core importing React/Next/Node/AI libraries or using Math.random / Date.now / fetch; planning docs committed under docs/planning; .codenow/ ignored.
- Files: `src/core/fraction.ts`, `src/core/rng.ts`, `src/core/types.ts`, `src/core/skills/linear-both-sides.ts`, `src/core/diagnose.ts`, `src/core/__tests__/{fraction,rng,linear-both-sides,diagnose}.test.ts`, `eslint.config.mjs`, `.gitignore`, `docs/planning/*`, `BUILD_LOG.md`.
- Built in AgentFoundry with Claude Code.

## 2026-10-18: Task 3, equation checker, teach check, apply item
- What was done: tests first (4 new test files failed because the code did not exist), then the code until all passed. A parser for typed lines in x (ASCII or Unicode minus, optional spaces, implied 1, never throws, child-friendly error messages); root() and equivalent(); target-form rules for lines 2–5 of the trace; checkTeachStep() for "Teach the Shishya" (did the child tap the first wrong line, and is the typed fix equivalent AND the right shape for that line), with NCERT-language feedback that never states the answer; and the taxi-fare word problem in English and Hindi (seeded; per-km ₹8–₹30, fixed ₹20–₹300 in steps of ₹10, answer 1–50 km).
- Tests: 90 passing (57 new). Property tests over 1,000 seeds: every correct trace line parses, is equivalent to the question and meets its target form; every mistake's first wrong line is NOT equivalent; the teach check accepts the correct line and rejects the Shishya's line for every mistake, with no answer leaks; every taxi item meets its constraints. The parser was also fed 2,000 random junk strings without throwing. Taxi generator: about 6.5 tries on average, max 70 over 20,000 seeds.
- Files: `src/core/equation.ts`, `src/core/targetForm.ts`, `src/core/teach.ts`, `src/core/skills/linear-both-sides-apply.ts`, `src/core/__tests__/{equation,targetForm,teach,linear-both-sides-apply}.test.ts`, `BUILD_LOG.md`.
- Built in AgentFoundry with Claude Code.
