import type { ChatMessage, ChatModel, ToolDef } from "./llm";

// The agent loop, by hand and short:
//   1. send the conversation + the tool list to the model;
//   2. if it answers in words, that is the final answer: stop;
//   3. if it asks for tools, run each one and add its result to the conversation;
//   4. if a tool says "this ends the run", stop; otherwise go back to 1, at most maxTurns times.
// Tools never throw at the model: errors come back as text it can read and fix.

export type ToolOutcome = { content: string; endsRun?: boolean };
export type AgentTool = { def: ToolDef; run(args: unknown): ToolOutcome | Promise<ToolOutcome> };
export type AgentResult = {
  status: "final" | "ended_by_tool" | "max_turns";
  turns: number;
  final?: string;
  endedBy?: string;
  messages: ChatMessage[];
};

export async function runAgent(opts: {
  model: ChatModel;
  system: string;
  user: string;
  tools: AgentTool[];
  maxTurns: number;
}): Promise<AgentResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  const byName = new Map(opts.tools.map((t) => [t.def.function.name, t]));

  for (let turn = 1; turn <= opts.maxTurns; turn++) {
    const { message } = await opts.model({ messages, tools: opts.tools.map((t) => t.def) });
    messages.push(message);
    const calls = message.tool_calls ?? [];
    if (calls.length === 0) return { status: "final", turns: turn, final: message.content ?? "", messages };

    for (const call of calls) {
      const outcome = await runTool(byName.get(call.function.name), call.function.name, call.function.arguments);
      messages.push({ role: "tool", tool_call_id: call.id, content: outcome.content });
      if (outcome.endsRun) return { status: "ended_by_tool", turns: turn, endedBy: call.function.name, messages };
    }
  }
  return { status: "max_turns", turns: opts.maxTurns, messages };
}

async function runTool(tool: AgentTool | undefined, name: string, rawArgs: string): Promise<ToolOutcome> {
  if (!tool) return { content: `Error: unknown tool "${name}".` };
  let args: unknown;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { content: "Error: the tool arguments were not valid JSON." };
  }
  try {
    return await tool.run(args);
  } catch (e) {
    return { content: `Error: ${e instanceof Error ? e.message : "the tool failed"}` };
  }
}
