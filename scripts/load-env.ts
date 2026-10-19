// Settings for the command-line agents (npm run miner / npm run author). Values are never printed.
//   1. .env.local (your keys and settings; never committed)
//   2. .env.example fills in only NON-secret settings that are still missing: model names, provider order, daily caps.
// Variables already set in the environment always win.

import { existsSync, readFileSync } from "node:fs";

function parse(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

const NON_SECRET = (key: string) => key === "LLM_PROVIDERS" || key.endsWith("_MODEL") || key.endsWith("_DAILY_CAP");

export function loadEnv() {
  for (const [k, v] of Object.entries(parse(".env.local"))) if (process.env[k] === undefined) process.env[k] = v;
  for (const [k, v] of Object.entries(parse(".env.example"))) {
    if (NON_SECRET(k) && v && process.env[k] === undefined) process.env[k] = v;
  }
}
