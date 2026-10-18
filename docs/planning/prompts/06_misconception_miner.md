Task 6: a free, switchable AI client + the Misconception Miner agent. Read CLAUDE.md first. Work autonomously. Tests first.
NO new dependency: use fetch.

A. AI client (src/agents/llm.ts)
 - Talks to any OpenAI-compatible /chat/completions endpoint with tool calling.
 - Providers in order, from env: LLM_PROVIDERS="groq,openrouter". Per provider: GROQ_API_KEY + GROQ_MODEL
   (base https://api.groq.com/openai/v1), OPENROUTER_API_KEY + OPENROUTER_MODEL (base https://openrouter.ai/api/v1,
   a ":free" model). If one fails or hits a rate limit (HTTP 429), try the next. If none has a key, fail with a clear message.
 - Never log keys. Log each call (provider, model, tokens, time, ok/fail) to data/agent-runs.jsonl (local) or stdout (cloud).
 - Daily cap per provider from env (default 200 calls) so we stay inside free limits.
 - Privacy rule: this client must never be given student codes, names or anything a child typed in free text. Add a test
   that scans src/agents for imports of student/session data.
B. Agent loop (src/agents/loop.ts), hand-written and short (Das must understand it): send messages + tool definitions,
   if the model asks for a tool, run it, append the result, repeat; stop at a final answer, at maxTurns, or at a tool that
   ends the run. Unit-test it with a FAKE model (no network) that requests tools in a scripted order.
C. Safety design for the Miner: the agent writes DATA, never code. A mined mistake is JSON:
   { id, label, childLabel, stepType, firstWrongLine (2..5), lines: {"<n>": "<template>"} for firstWrongLine..5,
     answerFormula: "<arithmetic over a, b, c, d>" }  e.g. answerFormula "(d - b) / a".
   Templates/formulas use ONLY a, b, c, d, integers, + − × ÷ and brackets. Write our own tiny safe evaluator in
   src/core/minedMistake.ts (no eval, no Function, no imports). Lines before firstWrongLine come from the correct trace.
D. Validator (src/core/minedMistake.ts, pure, tests first): only allowed symbols; reproduces at least 3 of the logged unknown
   wrong answers; on 1,000 generated instances never gives the correct answer, never divides by zero, differs from every
   existing mistake; its last line equals "x = <answerFormula>"; its first wrong line is NOT equivalent to the question.
E. Miner (src/agents/miner.ts, `npm run miner -- alg.linear.both-sides`): tools get_unknown_errors (read-only: anonymous
   a,b,c,d + wrong answer + count), validate_mined_mistake(json), submit_draft(json) (only after a passing validation; saves
   status DRAFT_TESTED). Max 12 turns, up to 5 validation retries. Approved mined mistakes are loaded into the skill registry
   (origin "mined") so diagnosis, Teach traces and the stuck board use them; teacher Approve/Reject on /teacher/[class].
   Mastery is never touched.
F. Tests: the whole Miner flow with the FAKE model proposing "(d - b) / a" for 6 seeded unknown errors like 5/2 for
   4x − 3 = 2x + 7 → validated → draft saved → approved → diagnosis now names it. If a real key exists in .env.local, also run
   it once for real and report the result honestly (if no key, say so and skip).
Run npm test, lint, build; commit "Agent: free AI client and Misconception Miner"; update BUILD_LOG.md; explain in plain
English what the agent loop does step by step and why the agent cannot harm a child's record.
