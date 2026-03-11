import { describe, expect } from "vitest";
import { Layer } from "effect";
import { makeTests, success, failure } from "@testConfig/test-helpers";
import { runInference } from "./ai";
import type { Message } from "./ai";

const msg: Message[] = [{ role: "user", content: "hello" }];

const mockAi = (result: unknown): Ai =>
  ({ run: async () => result }) as unknown as Ai;

const throwingAi: Ai = {
  run: async () => {
    throw new Error("network error");
  },
} as unknown as Ai;

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
        } as unknown as Ai,
        msg,
        "@cf/meta/llama-3.1-8b-instruct",
      ),
      layers: Layer.empty,
      assert: (r) =>
        expect(r).toBe("used:@cf/meta/llama-3.1-8b-instruct"),
    }),
  ]);
});
