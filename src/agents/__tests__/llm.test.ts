import { describe, expect, it } from "vitest";
import { createLlmClient, memoryCallLog, providersFromEnv, type CallRecord } from "../llm";

const GROQ_KEY = "gsk_test_SECRET_groq_0123456789";
const OR_KEY = "sk-or-test-SECRET-openrouter-0123";
const request = { messages: [{ role: "user" as const, content: "hi" }], tools: [] };
const reply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content } }], usage: { prompt_tokens: 5, completion_tokens: 2 } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

/** A fake fetch: each provider host answers with the next scripted status (or throws "network"). */
function fakeFetch(script: Record<string, (number | "network")[]>) {
  const calls: { url: string; auth: string; body: Record<string, unknown> }[] = [];
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const host = u.includes("groq") ? "groq" : "openrouter";
    calls.push({ url: u, auth: new Headers(init?.headers).get("Authorization") ?? "", body: JSON.parse(String(init?.body)) });
    const next = script[host].shift();
    if (next === "network") throw new TypeError("fetch failed");
    if (next === 200) return reply(`hello from ${host}`);
    return new Response("{}", { status: next ?? 500 });
  };
  return { fn: fn as typeof fetch, calls };
}

const env = { GROQ_API_KEY: GROQ_KEY, OPENROUTER_API_KEY: OR_KEY };

describe("providers", () => {
  it("reads providers in LLM_PROVIDERS order, skipping ones without a key", () => {
    expect(providersFromEnv(env).map((p) => p.name)).toEqual(["groq", "openrouter"]);
    expect(providersFromEnv({ ...env, LLM_PROVIDERS: "openrouter,groq" }).map((p) => p.name)).toEqual(["openrouter", "groq"]);
    expect(providersFromEnv({ OPENROUTER_API_KEY: OR_KEY }).map((p) => p.name)).toEqual(["openrouter"]);
    expect(providersFromEnv({ GROQ_API_KEY: GROQ_KEY })[0]).toMatchObject({ baseUrl: "https://api.groq.com/openai/v1" });
  });

  it("only allows a free OpenRouter model", () => {
    expect(providersFromEnv({ OPENROUTER_API_KEY: OR_KEY, OPENROUTER_MODEL: "openai/gpt-4o" })).toEqual([]);
    expect(providersFromEnv({ OPENROUTER_API_KEY: OR_KEY, OPENROUTER_MODEL: "some/model:free" })[0].model).toBe("some/model:free");
  });
});

describe("createLlmClient", () => {
  it("fails with a clear message when no key is set", async () => {
    const chat = createLlmClient({ env: {}, log: memoryCallLog() });
    await expect(chat(request)).rejects.toThrow(/GROQ_API_KEY|OPENROUTER_API_KEY/);
  });

  it("calls the first provider with an OpenAI-style request", async () => {
    const f = fakeFetch({ groq: [200], openrouter: [] });
    const chat = createLlmClient({ env, fetchImpl: f.fn, log: memoryCallLog() });
    const r = await chat({ ...request, tools: [{ type: "function", function: { name: "t", description: "d", parameters: {} } }] });
    expect(r.message.content).toBe("hello from groq");
    expect(r.provider).toBe("groq");
    expect(f.calls[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(f.calls[0].auth).toBe(`Bearer ${GROQ_KEY}`);
    expect(f.calls[0].body).toMatchObject({ messages: request.messages, tools: [{ type: "function" }] });
  });

  it("falls back to the next provider on a rate limit (429), an error or a network failure", async () => {
    for (const failure of [429, 500, "network"] as const) {
      const f = fakeFetch({ groq: [failure], openrouter: [200] });
      const log = memoryCallLog();
      const r = await createLlmClient({ env, fetchImpl: f.fn, log })(request);
      expect(r.provider).toBe("openrouter");
      expect(log.records.map((x: CallRecord) => [x.provider, x.ok])).toEqual([
        ["groq", false],
        ["openrouter", true],
      ]);
    }
  });

  it("when every provider fails, says which failed, never showing a key", async () => {
    const f = fakeFetch({ groq: [429], openrouter: [503] });
    const log = memoryCallLog();
    const err = await createLlmClient({ env, fetchImpl: f.fn, log })(request).catch((e: Error) => e);
    expect(String(err)).toMatch(/groq[\s\S]*429[\s\S]*openrouter[\s\S]*503/);
    for (const text of [String(err), JSON.stringify(log.records)]) {
      expect(text).not.toContain(GROQ_KEY);
      expect(text).not.toContain(OR_KEY);
    }
  });

  it("logs provider, model, tokens, time and ok — and nothing about the messages or keys", async () => {
    const f = fakeFetch({ groq: [200], openrouter: [] });
    const log = memoryCallLog();
    await createLlmClient({ env, fetchImpl: f.fn, log })({ messages: [{ role: "user", content: "PRIVATE TEXT" }], tools: [] });
    expect(log.records[0]).toMatchObject({ provider: "groq", ok: true, promptTokens: 5, completionTokens: 2 });
    expect(typeof log.records[0].ms).toBe("number");
    expect(JSON.stringify(log.records)).not.toContain("PRIVATE TEXT");
  });

  it("respects the daily cap per provider (default 200, or <NAME>_DAILY_CAP)", async () => {
    const now = () => new Date("2026-10-20T10:00:00Z");
    const log = memoryCallLog();
    for (let i = 0; i < 2; i++) log.record({ at: now().toISOString(), provider: "groq", model: "m", ok: true, ms: 1 });
    const f = fakeFetch({ groq: [200], openrouter: [200] });
    const r = await createLlmClient({ env: { ...env, GROQ_DAILY_CAP: "2" }, fetchImpl: f.fn, log, now })(request);
    expect(r.provider).toBe("openrouter"); // groq used up today's 2 calls
    const capped = createLlmClient({ env: { GROQ_API_KEY: GROQ_KEY, GROQ_DAILY_CAP: "2" }, fetchImpl: f.fn, log, now });
    await expect(capped(request)).rejects.toThrow(/daily cap/);
    expect(providersFromEnv(env)[0].dailyCap).toBe(200);
  });
});
