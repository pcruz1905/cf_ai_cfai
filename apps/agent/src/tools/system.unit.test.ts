import { describe, expect } from "vitest";
import { Effect, Layer } from "effect";
import { registerSystemTools } from "./system.js";
import { MockAgent } from "../../testConfig/mocks.js";
import { makeTests, success } from "../../testConfig/test-helpers.js";
import type { MessageRole } from "../index.js";

const setup = () => {
    const mock = new MockAgent();
    registerSystemTools(mock.asAgent());
    return mock;
};

describe("system tools", () => {
    makeTests([
        success({
            description: "registers system tools",
            effect: Effect.sync(() => setup().tools),
            layers: Layer.empty,
            assert: (tools: Map<string, unknown>) => {
                expect(tools.has("help")).toBe(true);
                expect(tools.has("set_model")).toBe(true);
                expect(tools.has("get_model")).toBe(true);
                expect(tools.has("session_stats")).toBe(true);
            },
        }),

        success({
            description: "calls help default category",
            effect: Effect.gen(function* () {
                const mock = setup();
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("help", { category: "all" }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }) => {
                expect(mock.tracked).toContain("help");
                expect(res.content[0]?.text).toContain("cfai — MCP Gateway");
                expect(res.content[0]?.text).toContain("AI Tools");
                expect(res.content[0]?.text).toContain("Gateway");
                expect(res.content[0]?.text).toContain("Model & Session");
            },
        }),

        success({
            description: "calls help specific category (ai)",
            effect: Effect.gen(function* () {
                const mock = setup();
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("help", { category: "ai" }),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res) => {
                expect(res.content[0]?.text).toContain("AI Tools");
                expect(res.content[0]?.text).not.toContain("🔌 Gateway");
            },
        }),

        success({
            description: "calls set_model",
            effect: Effect.gen(function* () {
                const mock = setup();
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("set_model", {
                        model: "@cf/meta/llama-3.1-8b-instruct",
                    }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }) => {
                expect(mock.tracked).toContain("set_model");
                expect(mock.state.selectedModel).toBe("@cf/meta/llama-3.1-8b-instruct");
                expect(res.content[0]?.text).toContain(
                    "Model set to: @cf/meta/llama-3.1-8b-instruct",
                );
            },
        }),

        success({
            description: "calls get_model",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.state.selectedModel = "test-model";
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("get_model"),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }) => {
                expect(mock.tracked).toContain("get_model");
                expect(res.content[0]?.text).toContain("Current model: test-model");
            },
        }),

        success({
            description: "calls session_stats",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.toolCounts = { help: 2, set_model: 1 };
                mock.totalRequests = 3;
                mock.state.selectedModel = "stats-model";
                mock.history = [{ role: "user" as MessageRole, content: "hi" }];
                mock.servers = [{ id: "1", url: "url", name: "name" }];

                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("session_stats"),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }) => {
                expect(mock.tracked).toContain("session_stats");
                const text = res.content[0]?.text ?? "";
                expect(text).toContain("Model: stats-model");
                expect(text).toContain("Total requests: 4");
                expect(text).toContain("Conversation messages stored: 1");
                expect(text).toContain("Upstream servers: 1");
                expect(text).toContain("help: 2");
                expect(text).toContain("set_model: 1");
                expect(text).toContain("session_stats: 1");
            },
        }),

        success({
            description: "calls session_stats with zero tool usage",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.toolCounts = {};
                mock.totalRequests = 1;
                // Force empty tool counts to trigger branch in system.ts
                mock.getToolCounts = () => ({});
                mock.state.selectedModel = "stats-model";
                mock.history = [];
                mock.servers = [];

                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("session_stats"),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res) => {
                const text = res.content[0]?.text ?? "";
                // Total is 2: 1 initial state (mock.totalRequests = 1) + 1 from tracking session_stats call itself
                expect(text).toContain("Total requests: 2");
                expect(text).not.toContain("By tool:");
            },
        }),
    ]);
});
