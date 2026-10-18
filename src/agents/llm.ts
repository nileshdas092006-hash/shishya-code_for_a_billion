import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// A small, free, switchable AI client for any OpenAI-compatible /chat/completions endpoint (with tool calling),
// using plain fetch. Providers are tried in order (LLM_PROVIDERS, default "groq,openrouter"); if one fails or is
// rate-limited (HTTP 429) the next is tried. Keys are never logged or put in error messages.
// Privacy rule: this client must never be given student codes, names or anything a child typed in free text
// (a test scans src/agents to enforce it).

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};
export type ToolDef = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };
export type ChatRequest = { messages: ChatMessage[]; tools: ToolDef[] };
export type ChatReply = { message: ChatMessage; provider: string; model: string };
/** Anything that answers a chat request: the real client, or a fake one in tests. */
export type ChatModel = (request: ChatRequest) => Promise<ChatReply>;

type Env = Record<string, string | undefined>;

export type Provider = { name: string; baseUrl: string; apiKey: string; model: string; dailyCap: number };

const KNOWN: Record<string, { baseUrl: string; keyVar: string; modelVar: string; defaultModel: string }> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    keyVar: "GROQ_API_KEY",
    modelVar: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    keyVar: "OPENROUTER_API_KEY",
    modelVar: "OPENROUTER_MODEL",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
  },
};
const DEFAULT_DAILY_CAP = 200;

/** The usable providers, in order. OpenRouter is only used with a ":free" model, so we never pay. */
export function providersFromEnv(env: Env = process.env): Provider[] {
  const order = (env.LLM_PROVIDERS ?? "groq,openrouter").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const out: Provider[] = [];
  for (const name of order) {
    const known = KNOWN[name];
    const apiKey = known && env[known.keyVar]?.trim();
    if (!known || !apiKey) continue;
    const model = env[known.modelVar]?.trim() || known.defaultModel;
    if (name === "openrouter" && !model.endsWith(":free")) continue;
    const cap = Number(env[`${name.toUpperCase()}_DAILY_CAP`] ?? env.LLM_DAILY_CAP ?? DEFAULT_DAILY_CAP);
    out.push({ name, baseUrl: known.baseUrl, apiKey, model, dailyCap: Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_DAILY_CAP });
  }
  return out;
}

// ---------- call log ----------

export type CallRecord = {
  at: string;
  provider: string;
  model: string;
  ok: boolean;
  ms: number;
  status?: number;
  promptTokens?: number;
  completionTokens?: number;
  error?: string;
};
export type CallLog = { record(r: CallRecord): void; countToday(provider: string, now: Date): number };

const sameDay = (iso: string, now: Date) => iso.slice(0, 10) === now.toISOString().slice(0, 10);

export function memoryCallLog(): CallLog & { records: CallRecord[] } {
  const records: CallRecord[] = [];
  return {
    records,
    record: (r) => void records.push(r),
    countToday: (provider, now) => records.filter((r) => r.provider === provider && sameDay(r.at, now)).length,
  };
}

/** Local runs: one JSON line per call in data/agent-runs.jsonl (the daily cap survives between runs). */
export function fileCallLog(path = join(process.cwd(), "data", "agent-runs.jsonl")): CallLog {
  return {
    record(r) {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, JSON.stringify(r) + "\n");
    },
    countToday(provider, now) {
      if (!existsSync(path)) return 0;
      return readFileSync(path, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as CallRecord;
          } catch {
            return null;
          }
        })
        .filter((r) => r && r.provider === provider && sameDay(r.at, now)).length;
    },
  };
}

/** Cloud runs (Vercel has no lasting disk): log to stdout; the daily cap is counted per running instance. */
export function stdoutCallLog(): CallLog {
  const memory = memoryCallLog();
  return {
    record(r) {
      memory.record(r);
      console.log(`[agent-call] ${JSON.stringify(r)}`);
    },
    countToday: memory.countToday,
  };
}

const defaultLog = (env: Env) => (env.VERCEL || env.NODE_ENV === "production" ? stdoutCallLog() : fileCallLog());

// ---------- the client ----------

export function createLlmClient(
  opts: { env?: Env; fetchImpl?: typeof fetch; log?: CallLog; now?: () => Date; timeoutMs?: number } = {},
): ChatModel {
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? defaultLog(env);
  const now = opts.now ?? (() => new Date());
  const timeoutMs = opts.timeoutMs ?? 60_000;

  return async (request) => {
    const providers = providersFromEnv(env);
    if (providers.length === 0) {
      throw new Error("No AI provider key found. Put GROQ_API_KEY or OPENROUTER_API_KEY in .env.local (see .env.example).");
    }
    const failures: string[] = [];
    for (const p of providers) {
      if (log.countToday(p.name, now()) >= p.dailyCap) {
        failures.push(`${p.name}: daily cap of ${p.dailyCap} calls reached`);
        continue;
      }
      const started = Date.now();
      const base = { at: now().toISOString(), provider: p.name, model: p.model };
      try {
        const res = await fetchImpl(`${p.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${p.apiKey}`, "Content-Type": "application/json", "X-Title": "Shishya" },
          body: JSON.stringify({
            model: p.model,
            messages: request.messages,
            ...(request.tools.length ? { tools: request.tools, tool_choice: "auto" } : {}),
            temperature: 0,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          const why = res.status === 429 ? "rate limited" : "error";
          log.record({ ...base, ok: false, ms: Date.now() - started, status: res.status, error: why });
          failures.push(`${p.name}: HTTP ${res.status} (${why})`);
          continue;
        }
        const data = (await res.json()) as {
          choices?: { message?: ChatMessage }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const message = data.choices?.[0]?.message;
        if (!message) throw new Error("the reply had no message");
        log.record({
          ...base,
          ok: true,
          ms: Date.now() - started,
          status: res.status,
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
        });
        return { message: { role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls }, provider: p.name, model: p.model };
      } catch (e) {
        const why = e instanceof Error ? e.name === "TimeoutError" ? "timed out" : e.message : "failed";
        log.record({ ...base, ok: false, ms: Date.now() - started, error: why });
        failures.push(`${p.name}: ${why}`);
      }
    }
    throw new Error(`All AI providers failed: ${failures.join("; ")}`);
  };
}
