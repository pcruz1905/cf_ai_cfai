import { z } from "zod";
import { Effect } from "effect";
import { connectServer, runTool, textContent } from "../index.js";
import type { CfaiAgent } from "../index.js";

const PRESETS: Record<string, { url: string; name: string; description: string }> = {
    github: {
        url: "https://api.githubcopilot.com/mcp/",
        name: "GitHub",
        description: "GitHub Copilot MCP — repos, issues, PRs, code search",
    },
};

export function registerGatewayTools(agent: CfaiAgent) {
    agent.server.registerTool(
        "add_server",
        {
            description:
                "Connect an upstream MCP server. Use a preset name (e.g. 'github') or provide a URL directly.",
            inputSchema: {
                url: z.string().optional().describe("The MCP server endpoint URL (SSE or Streamable HTTP)"),
                preset: z
                    .string()
                    .optional()
                    .describe(`Preset name instead of URL. Available: ${Object.keys(PRESETS).join(", ")}`),
                name: z.string().optional().describe("A friendly name for this server"),
            },
        },
        async ({ url, preset, name }) => {
            const connectAndSave = Effect.fn("connectAndSave")(function* () {
                yield* Effect.annotateCurrentSpan("url", url ?? "none");
                yield* Effect.annotateCurrentSpan("preset", preset ?? "none");

                let serverUrl: string;
                let label: string;

                if (preset) {
                    const p = PRESETS[preset.toLowerCase()];
                    if (!p) {
                        const available = Object.entries(PRESETS)
                            .map(([k, v]) => `  • ${k} — ${v.description}`)
                            .join("\n");
                        return `Unknown preset "${preset}". Available presets:\n${available}`;
                    }
                    serverUrl = p.url;
                    label = name ?? p.name;
                } else if (url) {
                    serverUrl = url;
                    label = name ?? new URL(url).hostname;
                } else {
                    return "Provide either a 'url' or a 'preset' name. Use help { \"category\": \"gateway\" } for examples.";
                }

                const { id } = yield* connectServer(agent.mcp, serverUrl);
                agent.saveServer(id, serverUrl, label);

                const conn = agent.mcp.mcpConnections[id];
                const tools = conn?.tools ?? [];
                // Broadcast to WebSocket clients
                agent.broadcast({ type: "server_connected", label, toolCount: 0 });

                const toolList = tools.length > 0
                    ? tools.map((t: { name: string; description?: string }) => `  • ${t.name}${t.description ? ` — ${t.description}` : ""}`).join("\n")
                    : "  (no tools discovered yet)";

                return (
                    `✅ Connected to "${label}"\n` +
                    `   Server ID: ${id}\n\n` +
                    `Tools discovered (${tools.length}):\n${toolList}\n\n` +
                    `Use call_upstream_tool { "serverId": "${id}", "toolName": "..." } to invoke them.`
                );
            });

            agent.track("add_server");
            const text = await runTool(connectAndSave());
            return textContent(text);
        },
    );

    agent.server.registerTool(
        "remove_server",
        {
            description: "Disconnect and remove an upstream MCP server.",
            inputSchema: {
                id: z.string().describe("The server ID (from list_servers)"),
            },
        },
        async ({ id }) => {
            agent.track("remove_server");
            try {
                await agent.mcp.closeConnection(id);
            } catch {
                // Already disconnected
            }
            agent.deleteServer(id);
            return textContent(`Removed server ${id}`);
        },
    );

    agent.server.registerTool(
        "list_servers",
        {
            description: "List all configured upstream MCP servers and their connection status.",
        },
        async () => {
            agent.track("list_servers");
            const saved = agent.getServers();
            const connections = agent.mcp.mcpConnections;

            if (saved.length === 0) {
                return textContent("No upstream servers configured. Use add_server to connect one.");
            }

            const lines = saved.map((s) => {
                const conn = connections[s.id];
                const status = conn?.connectionState ?? "disconnected";
                const toolCount = conn?.tools?.length ?? 0;
                return `• ${s.name || s.url} (${status}, ${toolCount} tools)\n  id: ${s.id}\n  url: ${s.url}`;
            });

            return textContent(`Upstream servers:\n\n${lines.join("\n\n")}`);
        },
    );

    agent.server.registerTool(
        "list_upstream_tools",
        {
            description: "List all tools available across connected upstream MCP servers.",
        },
        async () => {
            agent.track("list_upstream_tools");
            const tools = agent.mcp.listTools();

            if (tools.length === 0) {
                return textContent("No upstream tools available. Connect a server first with add_server.");
            }

            const lines = tools.map(
                (t) => `• ${t.name} [${t.serverId}]\n  ${t.description ?? "(no description)"}`,
            );

            return textContent(`Available upstream tools (${tools.length}):\n\n${lines.join("\n\n")}`);
        },
    );

    agent.server.registerTool(
        "call_upstream_tool",
        {
            description:
                "Call a tool on a connected upstream MCP server. Use list_upstream_tools to find available tools.",
            inputSchema: {
                serverId: z.string().describe("The server ID that provides the tool"),
                toolName: z.string().describe("The name of the tool to call"),
                args: z
                    .record(z.unknown())
                    .optional()
                    .default({})
                    .describe("Arguments to pass to the tool (JSON object)"),
            },
        },
        async ({ serverId, toolName, args }) => {
            agent.track("call_upstream_tool");
            try {
                const result = await agent.mcp.callTool({
                    serverId,
                    name: toolName,
                    arguments: args,
                });
                // Upstream MCP servers return content as an array of { type, text }.
                // If missing, serialize the raw result.
                const content = Array.isArray(result.content) && result.content.length > 0
                    ? result.content
                    : [{ type: "text" as const, text: JSON.stringify(result) }];
                return { content };
            } catch (e) {
                return textContent(`❌ Tool call failed: ${String(e)}`);
            }
        },
    );
}
