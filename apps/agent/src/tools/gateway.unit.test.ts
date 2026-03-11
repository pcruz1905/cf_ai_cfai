import { describe, expect } from "vitest";
import { Effect, Layer } from "effect";
import { registerGatewayTools } from "./gateway.js";
import { MockAgent } from "../../testConfig/mocks.js";
import { makeTests, success } from "../../testConfig/test-helpers.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const setup = () => {
    const mock = new MockAgent();
    registerGatewayTools(mock.asAgent());
    return mock;
};

describe("gateway tools", () => {
    makeTests([
        success({
            description: "registers gateway tools",
            effect: Effect.sync(() => setup().tools),
            layers: Layer.empty,
            assert: (tools: Map<string, unknown>) => {
                expect(tools.has("add_server")).toBe(true);
                expect(tools.has("remove_server")).toBe(true);
                expect(tools.has("list_servers")).toBe(true);
                expect(tools.has("list_upstream_tools")).toBe(true);
                expect(tools.has("call_upstream_tool")).toBe(true);
            },
        }),

        success({
            description: "add_server with preset",
            effect: Effect.gen(function* () {
                const mock = setup();
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("add_server", { preset: "github" }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(mock.tracked).toContain("add_server");
                expect(mock.servers.length).toBe(1);
                expect(mock.servers[0]!.url).toBe("https://api.githubcopilot.com/mcp/");
                expect(mock.servers[0]!.name).toBe("GitHub");
                expect(res.content[0].text).toContain('Connected to "GitHub"');
                expect(mock.broadcasted).toHaveLength(1);
                expect(mock.broadcasted[0].type).toBe("server_connected");
            },
        }),

        success({
            description: "add_server with unknown preset",
            effect: Effect.gen(function* () {
                const mock = setup();
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("add_server", { preset: "nonexistent" }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(res.content[0].text).toContain('Unknown preset "nonexistent"');
                expect(mock.servers.length).toBe(0);
            },
        }),

        success({
            description: "add_server with direct URL",
            effect: Effect.gen(function* () {
                const mock = setup();
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("add_server", {
                        url: "http://example.com/sse",
                        name: "Custom",
                    }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(mock.servers.length).toBe(1);
                expect(mock.servers[0]!.url).toBe("http://example.com/sse");
                expect(mock.servers[0]!.name).toBe("Custom");
                expect(res.content[0].text).toContain("Connected to");
            },
        }),

        success({
            description: "add_server without preset or URL",
            effect: Effect.gen(function* () {
                const mock = setup();
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("add_server", {}),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                expect(res.content[0].text).toContain(
                    "Provide either a 'url' or a 'preset' name",
                );
            },
        }),

        success({
            description: "add_server connection failure",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.mcp.connect = async () => {
                    throw new Error("connection failed");
                };
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("add_server", { url: "http://fail.com" }),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                expect(res.content[0].text).toContain(
                    "Failed to connect to http://fail.com",
                );
            },
        }),

        success({
            description: "remove_server",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.saveServer("abc", "url", "name");
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("remove_server", { id: "abc" }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(mock.tracked).toContain("remove_server");
                expect(mock.servers.length).toBe(0);
                expect(res.content[0].text).toContain("Removed server abc");
            },
        }),

        success({
            description: "list_servers when empty",
            effect: Effect.gen(function* () {
                const mock = setup();
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("list_servers", {}),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                expect(res.content[0].text).toContain("No upstream servers configured");
            },
        }),

        success({
            description: "list_servers with servers",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.saveServer("abc", "http://a.com", "Server A");
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("list_servers", {}),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                expect(res.content[0].text).toContain("Server A");
                expect(res.content[0].text).toContain("abc");
            },
        }),

        success({
            description: "list_upstream_tools when empty",
            effect: Effect.gen(function* () {
                const mock = setup();
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("list_upstream_tools", {}),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                expect(res.content[0].text).toContain("No upstream tools available");
            },
        }),

        success({
            description: "list_upstream_tools with tools",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.mcp.listTools = () => [
                    { name: "toolA", description: "desc A", inputSchema: { type: "object", properties: {} }, serverId: "abc" } as Tool & { serverId?: string },
                ];
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("list_upstream_tools", {}),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                expect(res.content[0].text).toContain("toolA [abc]");
                expect(res.content[0].text).toContain("desc A");
            },
        }),

        success({
            description: "call_upstream_tool success",
            effect: Effect.gen(function* () {
                const mock = setup();
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("call_upstream_tool", {
                        serverId: "abc",
                        toolName: "toolA",
                        args: { a: 1 },
                    }),
                );
                return { mock, res };
            }),
            layers: Layer.empty,
            assert: ({ mock, res }: { mock: MockAgent; res: any }) => {
                expect(mock.tracked).toContain("call_upstream_tool");
                expect(res.content[0].text).toBe("mock upstream result");
            },
        }),

        success({
            description: "call_upstream_tool failure",
            effect: Effect.gen(function* () {
                const mock = setup();
                mock.mcp.callTool = async () => {
                    throw new Error("upstream failed");
                };
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("call_upstream_tool", {
                        serverId: "abc",
                        toolName: "toolA",
                    }),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                expect(res.content[0].text).toContain("❌ Tool call failed");
            },
        }),
    ]);
});
