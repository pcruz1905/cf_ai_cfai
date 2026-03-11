import { Effect } from "effect";
import { WorkersAiError } from "./errors.js";

export const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as const;

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Run inference against Llama 3.3 70B via Workers AI.
 * Uses Effect.fn for automatic tracing and typed errors.
 */
export const runInference = Effect.fn("CfaiAgent.runInference")(function* (
  ai: Ai,
  messages: Message[],
) {
  const result = yield* Effect.tryPromise({
    try: () => ai.run(MODEL, { messages }),
    catch: (e) => new WorkersAiError({ message: String(e) }),
  });

  if (typeof result === "string") return result;
  if ("response" in result && result.response) return result.response;
  return yield* new WorkersAiError({
    message: "Workers AI returned an empty response",
  });
});
