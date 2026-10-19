// npm run miner -- alg.linear.both-sides [--fake] [--db file:data/demo.db]
// Runs the Misconception Miner once. It reads the anonymous unknown wrong answers, asks the AI for ONE new mistake
// (as data), checks it with code, and saves a tested draft for a teacher to approve on the class board.
//   --fake  use the offline FAKE model (no key, no network): it proposes "(d - b) / a".
//   --db    which database (default: DATABASE_URL, else file:data/shishya.db).
// Keys come from .env.local (GROQ_API_KEY / OPENROUTER_API_KEY) and are never printed.

import { finalAnswer, scriptedModel, toolCall } from "../src/agents/fake-model";
import { createLlmClient, providersFromEnv } from "../src/agents/llm";
import { runMiner } from "../src/agents/miner";
import { createMinerPorts } from "../src/server/miner-ports";
import { openStore } from "../src/server/store";
import { loadEnv } from "./load-env";

loadEnv();
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fake = args.includes("--fake");
const skillId = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--db") ?? "alg.linear.both-sides";
const url = flag("--db") ?? process.env.DATABASE_URL ?? "file:data/shishya.db";

if (!fake && providersFromEnv().length === 0) {
  console.log(
    "No usable AI provider yet: put GROQ_API_KEY + GROQ_MODEL, or OPENROUTER_API_KEY + OPENROUTER_MODEL (a :free model), in .env.local (see .env.example). Use --fake to try it offline.",
  );
  process.exit(0);
}

const DIVIDE_BY_A = {
  id: "divided-by-a",
  label: "Divided by the x-coefficient from the question instead of the collected one: x = (d − b) / a",
  childLabel: "After you collect the x-terms, divide both sides by the number in front of x in that line, not the one in the question.",
  stepType: "divide",
  firstWrongLine: 5,
  lines: { "5": "x = {(d - b) / a}" },
  answerFormula: "(d - b) / a",
};
const model = fake
  ? scriptedModel([
      toolCall("get_unknown_errors", {}),
      toolCall("validate_mined_mistake", { mistake: DIVIDE_BY_A }),
      toolCall("submit_draft", { mistake: DIVIDE_BY_A }),
      finalAnswer("The fake model has no other idea."),
    ])
  : createLlmClient();

const store = await openStore({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
try {
  console.log(`Misconception Miner: skill ${skillId}, ${fake ? "FAKE model" : `AI providers: ${providersFromEnv().map((p) => `${p.name} (${p.model})`).join(", ")}`}`);
  const result = await runMiner({ model, ports: createMinerPorts(store), skillId });
  console.log(`  unknown wrong answers (kinds): ${result.unknownErrors}`);
  console.log(`  result: ${result.status}${result.draftId ? ` → draft ${result.draftId} (waiting for a teacher on the class board)` : ""}`);
  console.log(`  validations: ${result.validations}, turns: ${result.turns}${result.agentStatus ? `, stopped: ${result.agentStatus}` : ""}`);
  for (const [i, a] of result.attempts.entries()) {
    console.log(`  proposal ${i + 1}: ${a.id}  x = ${a.answerFormula}  → ${a.ok ? "PASSED" : "failed"} (explains ${a.reproduced} logged answers)`);
    for (const e of a.errors.slice(0, 3)) console.log(`      - ${e}`);
  }
  if (result.error) console.log(`  error: ${result.error}`);
  if (result.finalText) console.log(`  the model said: ${result.finalText.slice(0, 300)}`);
  if (!fake) console.log("  each AI call is logged (no keys, no messages) in data/agent-runs.jsonl");
} catch (e) {
  console.error(`Miner failed: ${e instanceof Error ? e.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  store.close();
}
