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

        success({
            description: "add_server discovery with tools",
            effect: Effect.gen(function* () {
                const mock = setup();
                const url = "http://tools.com/sse";
                // Pre-populate tools for this URL
                mock.mcp.mcpConnections[`mock-id-${url}`] = {
                    tools: [
                        { name: "tool1", description: "desc1" },
                        { name: "tool2" }
                    ]
                };
                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("add_server", { url, name: "ToolsServer" }),
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                const text = res.content[0].text;
                expect(text).toContain("Tools discovered (2)");
                expect(text).toContain("• tool1 — desc1");
                expect(text).toContain("• tool2");
            },
        }),

        success({
            description: "gateway tools branch edge cases",
            effect: Effect.gen(function* () {
                const mock = setup();
                const serverId = "edge-server";

                // 1. list_servers with default name (no name in DB)
                mock.saveServer(serverId, "http://edge.com", "");
                const listRes = yield* Effect.tryPromise(() => mock.callHandler("list_servers"));

                // 2. list_upstream_tools with no description
                mock.mcp.listTools = () => [
                    { name: "silent-tool", serverId, description: undefined, inputSchema: { type: "object" } } as any
                ];
                const toolListRes = yield* Effect.tryPromise(() => mock.callHandler("list_upstream_tools"));

                // 3. call_upstream_tool with non-array content
                mock.mcp.callTool = async () => ({ raw: "data" } as any);
                const callRes = yield* Effect.tryPromise(() =>
                    mock.callHandler("call_upstream_tool", { serverId, toolName: "silent-tool" })
                );

                return { listRes, toolListRes, callRes };
            }),
            layers: Layer.empty,
            assert: (value: any) => {
                const { listRes, toolListRes, callRes } = value as { listRes: any; toolListRes: any; callRes: any };
                expect(listRes.content[0].text).toContain("http://edge.com");
                expect(toolListRes.content[0].text).toContain("(no description)");
                expect(callRes.content[0].text).toContain('{"raw":"data"}');
            },
        }),

        success({
            description: "add_server where connection disappears (edge case)",
            effect: Effect.gen(function* () {
                const mock = setup();
                const url = "http://ghost.com";
                // Mock connect to return an ID but NOT populate mcpConnections
                mock.mcp.connect = async () => ({ id: "ghost-id", authUrl: undefined });
                // Ensure it's NOT there
                delete mock.mcp.mcpConnections["ghost-id"];

                const res = yield* Effect.tryPromise(() =>
                    mock.callHandler("add_server", { url })
                );
                return res;
            }),
            layers: Layer.empty,
            assert: (res: any) => {
                const text = res.content[0].text;
                expect(text).toContain("Tools discovered (0)");
                expect(text).toContain("  (no tools discovered yet)");
            },
        }),
    ]);
});
