import { Effect } from "effect";
import { WorkersAiError } from "./errors.js";

export const DEFAULT_MODEL =
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as const;

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Run inference against a Workers AI model.
 * Defaults to Llama 3.3 70B but accepts any model string.
 * Uses Effect.fn for automatic tracing and typed errors.
 */
export const runInference = Effect.fn("CfaiAgent.runInference")(function* (
  ai: Ai,
  messages: Message[],
  model: string = DEFAULT_MODEL,
) {
  const result = yield* Effect.tryPromise({
    try: async () => {
      const res = await ai.run(
        model as Parameters<Ai["run"]>[0],
        { messages } as never,
      );
      return res as string | { response?: string };
    },
    catch: (e) => new WorkersAiError({ message: String(e) }),
  });

  if (typeof result === "string") return result;
  if (typeof result === "object" && result !== null && "response" in result && result.response)
    return result.response;
  return yield* new WorkersAiError({
    message: "Workers AI returned an empty response",
  });
});

