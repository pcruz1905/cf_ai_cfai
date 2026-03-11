import { Effect } from "effect";
import { WorkersAiError } from "./errors.js";

export const DEFAULT_MODEL =
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as const;

/** Fallback models tried in order when the primary model fails. */
export const FALLBACK_MODELS = [
  "@cf/meta/llama-3.1-8b-instruct",
] as const;

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** The subset of Ai.run we actually use — avoids casting the model string. */
type AiTextModel = Parameters<Ai["run"]>[0];

/** Parse a Workers AI response into a string. */
function extractResponse(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null && "response" in raw) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.response === "string" && obj.response) return obj.response;
  }
  return undefined;
}

/** Call Workers AI with a specific model. */
const callModel = Effect.fn("CfaiAgent.callModel")(function* (
  ai: Ai,
  messages: Message[],
  model: string,
) {
  const raw = yield* Effect.tryPromise({
    try: () => ai.run(model as AiTextModel, { messages } as any),
    catch: (e) => new WorkersAiError({ message: `[${model}] ${String(e)}` }),
  });

  const text = extractResponse(raw);
  if (text) return text;

  return yield* new WorkersAiError({
    message: `[${model}] Workers AI returned an empty response`,
  });
});

/**
 * Run inference with automatic fallback.
 *
 * Tries the primary model first, then each fallback in order.
 * The first successful response wins. If all models fail,
 * the error from the last attempt is returned.
 */
export const runInference = Effect.fn("CfaiAgent.runInference")(function* (
  ai: Ai,
  messages: Message[],
  model: string = DEFAULT_MODEL,
) {
  const models = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let lastError: WorkersAiError | undefined;

  for (const m of models) {
    const result = yield* callModel(ai, messages, m).pipe(
      Effect.either,
    );

    if (result._tag === "Right") return result.right;
    lastError = result.left;
  }

  return yield* lastError ?? new WorkersAiError({
    message: "All models failed",
  });
});
