We are building Shishya for the Code for a Billion hackathon. First read ../02_plan.md and section 6 of ../01_research.md.
I am a beginner. Before you change anything, explain your plan in plain English. After each task, explain what each new file
does in 3 lines or less.

Task 1: project setup only (no Shishya features yet).
1. Check that Node.js (v20 or newer), npm and git are installed. If something is missing, stop and tell me how to install it on Windows.
2. In this folder (C:\Dev\code-for-a-billion\app), create a Next.js app: TypeScript, App Router, ESLint, Tailwind, src/ directory, npm.
   Do not add any other libraries yet.
3. Add Vitest for unit tests with an `npm test` script, and one trivial passing test so we know testing works.
4. Create src/core/README.md saying: "Pure TypeScript maths engine. No imports from React, Next.js, the database, the network or any AI model."
5. Create CLAUDE.md with these project rules, and follow them in every future task:
   - No AI/model output ever changes a child's mastery state. Only src/server/mastery.ts may write mastery.
   - Correct answers and mistake answers come only from src/core, never from a model.
   - src/core is pure: no I/O, no network, and no randomness except a seeded random generator passed in.
   - Tests first: write a failing test before every change to src/core. Every mistake function gets a property test over 1,000 random questions.
   - Never store children's names, camera, microphone, location or chat transcripts.
   - Children under 13 (Class 7) never see an AI chat.
   - Do not add a new dependency without asking me first and explaining why.
   - Child-facing text uses the NCERT textbook's language: "do the same operation on both sides", not "move it and change the sign".
   - After finishing any task, append an entry to BUILD_LOG.md (date, what was done, which files, "built in AgentFoundry with Claude Code")
     and explain it to me in plain English.
6. Create BUILD_LOG.md with a first entry for this setup.
7. Add an MIT LICENSE (Copyright 2026 Nilesh Kumar Das) and a short README.md (name, one-line description, how to run `npm run dev` and `npm test`).
8. Run `npm test` and `npm run build` and show me that both pass. Then run `git init` and make the first commit: "Project setup".
Do not build any Shishya features yet.
