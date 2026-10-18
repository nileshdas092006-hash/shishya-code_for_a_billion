Task 6: the Misconception Miner agent (needs ANTHROPIC_API_KEY in .env.local; check it exists and stop if not, without
printing it). Read CLAUDE.md first. Work autonomously. Ask before adding a dependency (the Claude Agent SDK
@anthropic-ai/claude-agent-sdk is expected; read its docs in node_modules after installing and use its real API).

Safety design: the agent writes DATA, never code. A mined mistake is a small JSON object, checked by our own code:
{ id, label, childLabel, stepType, firstWrongLine (2..5),
  lines: { "<lineNumber>": "<template>" } for every line from firstWrongLine to 5,
  answerFormula: "<arithmetic over a, b, c, d>" }
Templates and formulas use ONLY a, b, c, d, integers, + − × ÷ and brackets, e.g. answerFormula "(d - b) / a".
Write our own tiny safe evaluator in src/core/minedMistake.ts (no eval, no Function, no imports). Lines before
firstWrongLine are taken from the correct trace. Render templates with the same pretty printing as the skill.

A. Validator (src/core/minedMistake.ts, pure, with tests first):
 - parses, and only uses the allowed symbols;
 - reproduces at least 3 of the logged unknown wrong answers for that skill;
 - on 1,000 generated instances: never gives the correct answer, never divides by zero, and differs from every existing
   mistake's answer;
 - its last line equals "x = <answerFormula>";
 - its firstWrongLine is NOT equivalent to the original equation (use src/core/equation.ts).
B. Agent (src/agents/miner.ts, run with `npm run miner -- alg.linear.both-sides`):
 - tools: get_unknown_errors(skillId) (read-only, anonymous params + wrong answers + counts),
   validate_mined_mistake(json) (calls the validator and returns pass/fail with reasons),
   submit_draft(json) (only works if the last validation passed; saves to minedMistakes with status DRAFT_TESTED).
 - system prompt: explain the skill, the existing mistakes, and the JSON format; tell it to find ONE pattern that explains
   the most unknown errors; it may retry validation up to 5 times; model: a Claude Sonnet-class model, max 12 turns.
 - log every run (model, prompt version, tokens, cost estimate, result) to data/agent-runs.jsonl for the
   "How you used AgentFoundry" answer and the cost cap (stop if total spend in the log exceeds $25).
 - no network or file-system tools for the agent other than these three.
C. Wire-in: approved mined mistakes are loaded by the skill registry (origin "mined"), so diagnose(), the Shishya traces in
   Teach, and the stuck board all use them. Teacher Approve/Reject buttons on /teacher/[class] change status
   (APPROVED → used; REJECTED → kept for audit). Mastery is never touched.
D. Demo test: seed 6 unknown errors that match "divides by the original coefficient a" (e.g. 5/2 for 4x − 3 = 2x + 7),
   run the miner for real once, and show the validated draft. Commit "Agent: Misconception Miner", update BUILD_LOG.md,
   and explain in plain English what the agent can and cannot do, and why it cannot harm a child's record.
