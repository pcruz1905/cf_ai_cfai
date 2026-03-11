import { describe, expect } from "vitest";
import { Effect, Layer } from "effect";
import { registerAiTools } from "./ai.js";
import { MockAgent } from "../../testConfig/mocks.js";
import { makeTests, success } from "../../testConfig/test-helpers.js";
import type { MessageRole } from "../index.js";

const setup = () => {
    const mock = new MockAgent();
    registerAiTools(mock.asAgent());
    return mock;
};

describe("ai tools", () => {
    makeTests([
        success({
            description: "registers ai tools",
            effect: Effect.sync(() => setup().tools),
            layers: Layer.empty,
            assert: (tools: Map<string, unknown>) => {
                expect(tools.has("ask_llm")).toBe(true);
                expect(tools.has("explain_error")).toBe(true);
                expect(tools.has("summarize")).toBe(true);
                expect(tools.has("generate_commit")).toBe(true);
                expect(tools.has("translate")).toBe(true);
                expect(tools.has("review_code")).toBe(true);
            },
        }),

        success({
            description: "ask_llm",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.aiResponse = "llm response";
                mock.history = [{ role: "user" as MessageRole, content: "old message" }];
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("ask_llm", { question: "new question" }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(mock.tracked).toContain("ask_llm");
                expect(res.content[0].text).toBe("llm response");
                expect(mock.history.map((h) => h.content)).toContain("old message");
                expect(mock.history.map((h) => h.content)).toContain("new question");
                expect(mock.history.map((h) => h.content)).toContain("llm response");
            },
        }),

        success({
            description: "explain_error with context",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.aiResponse = "explained";
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("explain_error", {
                        error: "bad!",
                        context: "var x;",
                    }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(mock.tracked).toContain("explain_error");
                expect(res.content[0].text).toBe("explained");
            },
        }),

        success({
            description: "explain_error without context",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.aiResponse = "explained no context";
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("explain_error", { error: "bad!" }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(mock.tracked).toContain("explain_error");
                expect(res.content[0].text).toBe("explained no context");
            },
        }),

        success({
            description: "summarize with default format",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.aiResponse = "summary";
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("summarize", { content: "long text" }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(mock.tracked).toContain("summarize");
                expect(res.content[0].text).toBe("summary");
            },
        }),

        success({
            description: "summarize with specific format",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.aiResponse = "summary tables";
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("summarize", {
                        content: "long text",
                        format: "tables",
                    }),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                expect(res.content[0].text).toBe("summary tables");
            },
        }),

        success({
            description: "generate_commit",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.aiResponse = "feat: initial commit";
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("generate_commit", { diff: "+ code" }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(mock.tracked).toContain("generate_commit");
                expect(res.content[0].text).toBe("feat: initial commit");
            },
        }),

        success({
            description: "translate with source and target",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.aiResponse = "hola";
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("translate", {
                        text: "hello",
                        target: "Spanish",
                        source: "English",
                    }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(mock.tracked).toContain("translate");
                expect(res.content[0].text).toBe("hola");
            },
        }),

        success({
            description: "translate without source",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.aiResponse = "hola auto";
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("translate", {
                        text: "hello",
                        target: "Spanish",
                    }),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                expect(res.content[0].text).toBe("hola auto");
            },
        }),

        success({
            description: "review_code with specific focus and language",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.aiResponse = "looks good";
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("review_code", {
                        code: "fn()",
                        language: "typescript",
                        focus: "performance",
                    }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(mock.tracked).toContain("review_code");
                expect(res.content[0].text).toBe("looks good");
            },
        }),

        success({
            description: "review_code with auto language and default focus",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.aiResponse = "looks fine";
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("review_code", { code: "fn()" }),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                expect(res.content[0].text).toBe("looks fine");
            },
        }),
    ]);
});
