import { describe, expect, it } from "vitest";
import { finalAnswer, scriptedModel, toolCall } from "../fake-model";
import type { ChatMessage } from "../llm";
import { runAgent, type AgentTool } from "../loop";

function tool(name: string, run: AgentTool["run"]): AgentTool {
  return { def: { type: "function", function: { name, description: name, parameters: { type: "object" } } }, run };
}

describe("runAgent (with a FAKE model, no network)", () => {
  it("stops at a final answer", async () => {
    const r = await runAgent({ model: scriptedModel([finalAnswer("all done")]), system: "s", user: "u", tools: [], maxTurns: 5 });
    expect(r).toMatchObject({ status: "final", final: "all done", turns: 1 });
  });

  it("runs the tool the model asks for, gives it the result, and carries on", async () => {
    const seen: unknown[] = [];
    const add = tool("add", (args) => {
      seen.push(args);
      const { x, y } = args as { x: number; y: number };
      return { content: String(x + y) };
    });
    const model = scriptedModel([toolCall("add", { x: 2, y: 3 }, "call-1"), finalAnswer("the sum is 5")]);
    const r = await runAgent({ model, system: "s", user: "u", tools: [add], maxTurns: 5 });
    expect(seen).toEqual([{ x: 2, y: 3 }]);
    expect(r).toMatchObject({ status: "final", final: "the sum is 5", turns: 2 });
    const toolMsg = r.messages.find((m: ChatMessage) => m.role === "tool");
    expect(toolMsg).toMatchObject({ tool_call_id: "call-1", content: "5" });
    expect(model.requests[1].messages.at(-1)).toMatchObject({ role: "tool", content: "5" }); // the model saw the result
  });

  it("stops when a tool ends the run", async () => {
    const model = scriptedModel([toolCall("save", {}), finalAnswer("never reached")]);
    const save = tool("save", () => ({ content: "saved", endsRun: true }));
    const r = await runAgent({ model, system: "s", user: "u", tools: [save], maxTurns: 5 });
    expect(r).toMatchObject({ status: "ended_by_tool", endedBy: "save", turns: 1 });
    expect(model.requests).toHaveLength(1);
  });

  it("stops at maxTurns", async () => {
    const ping = tool("ping", () => ({ content: "pong" }));
    const model = scriptedModel(Array.from({ length: 10 }, () => toolCall("ping", {})));
    const r = await runAgent({ model, system: "s", user: "u", tools: [ping], maxTurns: 3 });
    expect(r).toMatchObject({ status: "max_turns", turns: 3 });
    expect(model.requests).toHaveLength(3);
  });

  it("tells the model about an unknown tool, bad JSON arguments or a failing tool, and keeps going", async () => {
    const boom = tool("boom", () => {
      throw new Error("tool broke");
    });
    const model = scriptedModel([
      toolCall("nope", {}),
      { role: "assistant", content: null, tool_calls: [{ id: "bad", type: "function", function: { name: "boom", arguments: "{not json" } }] },
      toolCall("boom", {}),
      finalAnswer("ok"),
    ]);
    const r = await runAgent({ model, system: "s", user: "u", tools: [boom], maxTurns: 6 });
    const results = r.messages.filter((m) => m.role === "tool").map((m) => m.content);
    expect(results[0]).toMatch(/unknown tool/i);
    expect(results[1]).toMatch(/JSON/);
    expect(results[2]).toMatch(/tool broke/);
    expect(r.status).toBe("final");
  });
});
