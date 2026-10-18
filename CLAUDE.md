# Shishya: project rules

Follow these rules in every task.

## Safety and correctness
- No AI/model output ever changes a child's mastery state. Only `src/server/mastery.ts` may write mastery.
- Correct answers and mistake answers come only from `src/core`, never from a model.
- `src/core` is pure: no I/O, no network, and no randomness except a seeded random generator passed in.
- Tests first: write a failing test before every change to `src/core`. Every mistake function gets a property test over 1,000 random questions.

## Children's privacy
- Never store children's names, camera, microphone, location or chat transcripts.
- Children under 13 (Class 7) never see an AI chat.

## Working rules
- Do not add a new dependency without asking Das first and explaining why.
- Child-facing text uses the NCERT textbook's language: "do the same operation on both sides", not "move it and change the sign".
- After finishing any task, append an entry to `BUILD_LOG.md` (date, what was done, which files, "built in AgentFoundry with Claude Code") and explain it to Das in plain English.

## Next.js
@AGENTS.md
