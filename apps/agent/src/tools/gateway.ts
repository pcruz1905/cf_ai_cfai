import { z } from "zod";
import { Effect } from "effect";
import { McpGatewayError } from "../errors.js";
import { textContent, runTool, connectServer } from "../utils.js";
import type { CfaiAgent } from "../index.js";

const PRESETS: Record<string, { url: string; name: string; description: string }> = {
  github: {
    url: "https://api.githubcopilot.com/mcp/",
    name: "GitHub",
    description: "GitHub Copilot MCP — repos, issues, PRs, code search",
  },
};

const connectAndSave = Effect.fn("add_server")(function* (
  agent: CfaiAgent,
  url: string | undefined,
  preset: string | undefined,
  name: string | undefined,
) {
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
    return `Provide either a 'url' or a 'preset' name. Use help { "category": "gateway" } for examples.`;
  }

  const { id } = yield* connectServer(agent.mcp, serverUrl);
  agent.saveServer(id, serverUrl, label);

  // mcpConnections is typed as any by the SDK — assert the shape we care about
  const conn = agent.mcp.mcpConnections[id] as
    | { tools: Array<{ name: string; description?: string }> }
    | undefined;
  const tools = conn?.tools ?? [];

  agent.broadcast({ type: "server_connected", label, toolCount: tools.length });

  const toolList =
    tools.length > 0
      ? tools.map((t) => `  • ${t.name}${t.description ? ` — ${t.description}` : ""}`).join("\n")
      : "  (no tools discovered yet)";

  return (
    `✅ Connected to "${label}"\n` +
    `   Server ID: ${id}\n\n` +
    `Tools discovered (${tools.length}):\n${toolList}\n\n` +
    `Use call_upstream_tool { "serverId": "${id}", "toolName": "..." } to invoke them.`
  );
});

const removeServer = Effect.fn("remove_server")(function* (
  agent: CfaiAgent,
  id: string,
) {
  yield* Effect.tryPromise({
    try: () => agent.mcp.closeConnection(id),
    catch: () => new McpGatewayError({ message: "Already disconnected" }),
  }).pipe(Effect.ignore);
  agent.deleteServer(id);
  return `Removed server ${id}`;
});

const callUpstreamTool = Effect.fn("call_upstream_tool")(function* (
  agent: CfaiAgent,
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
) {
  const result = yield* Effect.tryPromise({
    try: () => agent.mcp.callTool({ serverId, name: toolName, arguments: args }),
    catch: (e) => new McpGatewayError({ message: `Tool call failed: ${String(e)}` }),
  });
  // Extract text from content items; fall back to raw JSON
  if (Array.isArray(result.content) && result.content.length > 0) {
    const text = result.content
      .filter((c: unknown): c is { text: string } => typeof c === "object" && c !== null && "text" in c)
      .map((c) => c.text)
      .join("\n");
    return text || JSON.stringify(result);
  }
  return JSON.stringify(result);
});

export function registerGatewayTools(agent: CfaiAgent) {
  agent.server.registerTool(
    "add_server",
    {
      description:
        "Connect an upstream MCP server. Use a preset name (e.g. 'github') or provide a URL directly.",
      inputSchema: {
        url: z
          .string()
          .optional()
          .describe("The MCP server endpoint URL (SSE or Streamable HTTP)"),
        preset: z
          .string()
          .optional()
          .describe(
            `Preset name instead of URL. Available: ${Object.keys(PRESETS).join(", ")}`,
          ),
        name: z.string().optional().describe("A friendly name for this server"),
      },
    },
    async ({ url, preset, name }) => {
      agent.track("add_server");
      return textContent(await runTool(connectAndSave(agent, url, preset, name)));
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
      return textContent(await runTool(removeServer(agent, id)));
    },
  );

  agent.server.registerTool(
    "list_servers",
    {
      description:
        "List all configured upstream MCP servers and their connection status.",
    },
    async () => {
      agent.track("list_servers");
      const saved = agent.getServers();
      const connections = agent.mcp.mcpConnections as Record<
        string,
        { connectionState?: string; tools?: unknown[] } | undefined
      >;

      if (saved.length === 0) {
        return textContent(
          "No upstream servers configured. Use add_server to connect one.",
        );
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
      description:
        "List all tools available across connected upstream MCP servers.",
    },
    async () => {
      agent.track("list_upstream_tools");
      const tools = agent.mcp.listTools();

      if (tools.length === 0) {
        return textContent(
          "No upstream tools available. Connect a server first with add_server.",
        );
      }

      const lines = tools.map(
        (t) =>
          `• ${t.name} [${t.serverId}]\n  ${t.description ?? "(no description)"}`,
      );

      return textContent(
        `Available upstream tools (${tools.length}):\n\n${lines.join("\n\n")}`,
      );
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
      return textContent(await runTool(callUpstreamTool(agent, serverId, toolName, args)));
    },
  );
}
