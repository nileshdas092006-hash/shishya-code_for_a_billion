# Build log

## 2026-10-18: Task 1, project setup
- What was done: created the Next.js app (TypeScript, App Router, ESLint, Tailwind, `src/` directory, npm); added Vitest with an `npm test` script and one trivial passing test; added the project rules, the core README, an MIT licence and a README; ran `npm test` and `npm run build` (both pass); ran `git init` and made the first commit. No Shishya features yet.
- Note: `@types/node` was raised from `^20` to `^24` (matches the installed Node v24) because Vitest 5 requires `@types/node` 22 or newer.
- Files: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore`, `AGENTS.md`, `src/app/*`, `public/*`, `vitest.config.mts`, `src/core/sanity.test.ts`, `src/core/README.md`, `CLAUDE.md`, `BUILD_LOG.md`, `LICENSE`, `README.md`.
- Built in AgentFoundry with Claude Code.
