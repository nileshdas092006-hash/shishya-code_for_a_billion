import type { ChatMessage, ChatModel, ChatRequest } from "./llm";

// A FAKE model for tests and offline demos: it plays back a script of replies, no network, no key.

export type ScriptStep = ChatMessage | ((request: ChatRequest) => ChatMessage);

let nextId = 0;

/** An assistant reply that asks for one tool. */
export const toolCall = (name: string, args: unknown, id = `call-${++nextId}`): ChatMessage => ({
  role: "assistant",
  content: null,
  tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
});

/** An assistant reply in words (ends the loop). */
export const finalAnswer = (text: string): ChatMessage => ({ role: "assistant", content: text });

export function scriptedModel(script: ScriptStep[]): ChatModel & { requests: ChatRequest[] } {
  const requests: ChatRequest[] = [];
  let i = 0;
  const model = async (request: ChatRequest) => {
    requests.push({ messages: [...request.messages], tools: request.tools });
    const step = script[i++] ?? finalAnswer("I have nothing more to do.");
    return { message: typeof step === "function" ? step(request) : step, provider: "fake", model: "fake" };
  };
  return Object.assign(model, { requests });
}
