import { describe, expect } from "vitest";
import { Effect, Layer } from "effect";
import { makeTests, success, failure } from "@testConfig/test-helpers";
import { runInference, DEFAULT_MODEL } from "./ai.js";
import type { Message } from "./ai.js";

const msg: Message[] = [{ role: "user", content: "hello" }];

const mockAi = (result: unknown): Ai =>
  ({ run: async () => result, aiManager: null as any }) as any as Ai;

const throwingAi: Ai = {
  run: async () => {
    throw new Error("network error");
  },
  aiManager: null as any
} as any as Ai;

describe("runInference", () => {
  makeTests([
    success({
      description: "returns response string from object output",
      effect: runInference(mockAi({ response: "hello world" }), msg),
      layers: Layer.empty,
      assert: (r) => expect(r).toBe("hello world"),
    }),

    success({
      description: "returns string directly when output is a string",
      effect: runInference(mockAi("direct string"), msg),
      layers: Layer.empty,
      assert: (r) => expect(r).toBe("direct string"),
    }),

    failure({
      description: "fails with WorkersAiError when response is empty string",
      effect: runInference(mockAi({ response: "" }), msg),
      layers: Layer.empty,
      assert: (e) => {
        expect(e._tag).toBe("WorkersAiError");
        expect(e.message).toContain("empty response");
      },
    }),

    failure({
      description:
        "fails with WorkersAiError when output is an async response (no response field)",
      effect: runInference(mockAi({ request_id: "async-123" }), msg),
      layers: Layer.empty,
      assert: (e) => {
        expect(e._tag).toBe("WorkersAiError");
      },
    }),

    failure({
      description: "fails with WorkersAiError when ai.run throws",
      effect: runInference(throwingAi, msg),
      layers: Layer.empty,
      assert: (e) => {
        expect(e._tag).toBe("WorkersAiError");
        expect(e.message).toContain("network error");
      },
    }),

    success({
      description: "passes custom model to ai.run when provided",
      effect: runInference(
        {
          run: async (model: string) => ({ response: `used:${model}` }),
        } as any as Ai,
        msg,
        "@cf/meta/llama-3.1-8b-instruct",
      ),
      layers: Layer.empty,
      assert: (r) =>
        expect(r).toBe("used:@cf/meta/llama-3.1-8b-instruct"),
    }),
    success({
      description: "tries fallback model when primary fails",
      effect: Effect.gen(function* () {
        let calls = 0;
        const ai: Ai = {
          run: async (model: string) => {
            calls++;
            if (model === DEFAULT_MODEL) throw new Error("primary failed");
            return { response: "fallback success" };
          },
          aiManager: null as any
        } as any as Ai;
        const res = yield* runInference(ai, msg);
        return { res, calls };
      }),
      layers: Layer.empty,
      assert: (value) => {
        const { res, calls } = value as { res: string; calls: number };
        expect(res).toBe("fallback success");
        expect(calls).toBe(2);
      },
    }),

    failure({
      description: "fails when all models return empty response",
      effect: runInference(mockAi({ response: "" }), msg),
      layers: Layer.empty,
      assert: (e) => {
        expect((e as Error).message).toContain("empty response");
      },
    }),

    failure({
      description: "fails when everything fails",
      effect: Effect.gen(function* () {
        const ai: Ai = {
          run: async () => { throw new Error("hard fail"); },
          aiManager: null as unknown as any
        } as unknown as Ai;
        return yield* runInference(ai, msg);
      }),
      layers: Layer.empty,
      assert: (e) => {
        expect((e as Error).message).toContain("hard fail");
      },
    }),
  ]);
});
