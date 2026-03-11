import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect } from "effect";
import { z } from "zod";
import { runInference, DEFAULT_MODEL, type Message } from "./ai.js";
import { WorkersAiError } from "./errors.js";
import { PROMPTS } from "./prompts.js";

interface Env {
  AI: Ai;
  CFAI_AGENT: DurableObjectNamespace;
}

interface SessionState {
  totalRequests: number;
  toolCounts: Record<string, number>;
  selectedModel: string;
}

type DbMessage = { role: string; content: string };
type DbServer = { id: string; url: string; name: string };

/** Run an Effect and fall back to an error string — safe at the MCP boundary. */
function runTool(
  effect: Effect.Effect<string, WorkersAiError>,
): Promise<string> {
  return Effect.runPromise(
    effect.pipe(
      Effect.catchAll((e) =>
        Effect.succeed(`I encountered an error: ${e.message}`),
      ),
    ),
  );
}

export class CfaiAgent extends McpAgent<Env, SessionState> {
  override initialState: SessionState = {
    totalRequests: 0,
    toolCounts: {},
    selectedModel: DEFAULT_MODEL,
  };
  override server = new McpServer({ name: "cfai", version: "1.0.0" });

  override async init() {
    const ai = this.env.AI;

    // ── Persistent tables (SQLite in Durable Object) ──────────────────────
    this.sql`
      CREATE TABLE IF NOT EXISTS messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        role       TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
        content    TEXT    NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `;

    this.sql`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id    TEXT PRIMARY KEY,
        url   TEXT NOT NULL,
        name  TEXT NOT NULL DEFAULT '',
        added INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `;

    const loadHistory = (): Message[] =>
      this.sql<DbMessage>`
        SELECT role, content FROM messages ORDER BY id DESC LIMIT 20
      `
        .reverse()
        .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));

    const saveMessage = (role: "user" | "assistant", content: string) => {
      this.sql`INSERT INTO messages (role, content) VALUES (${role}, ${content})`;
    };

    const track = (tool: string) => {
      this.setState({
        ...this.state,
        totalRequests: this.state.totalRequests + 1,
        toolCounts: {
          ...this.state.toolCounts,
          [tool]: (this.state.toolCounts[tool] ?? 0) + 1,
        },
      });
    };

    /** Resolve the model to use for inference */
    const model = () => this.state.selectedModel ?? DEFAULT_MODEL;

    // ── Auto-reconnect saved MCP servers ──────────────────────────────────
    const savedServers = this.sql<DbServer>`SELECT id, url, name FROM mcp_servers`;
    for (const srv of savedServers) {
      try {
        await this.mcp.connect(srv.url);
      } catch {
        // Server might be offline — that's OK, user can retry later
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  MCP Server Management Tools
    // ══════════════════════════════════════════════════════════════════════

    this.server.registerTool(
      "add_server",
      {
        description:
          "Connect an upstream MCP server by URL. Its tools become available via list_upstream_tools and call_upstream_tool.",
        inputSchema: {
          url: z.string().url().describe("The MCP server endpoint URL (SSE or Streamable HTTP)"),
          name: z.string().optional().describe("A friendly name for this server"),
        },
      },
      async ({ url, name }) => {
        track("add_server");
        try {
          const { id } = await this.mcp.connect(url);
          const label = name ?? new URL(url).hostname;
          this.sql`INSERT OR REPLACE INTO mcp_servers (id, url, name) VALUES (${id}, ${url}, ${label})`;
          return {
            content: [{ type: "text" as const, text: `✅ Connected to "${label}" (id: ${id})` }],
          };
        } catch (e) {
          return {
            content: [{ type: "text" as const, text: `❌ Failed to connect: ${String(e)}` }],
          };
        }
      },
    );

    this.server.registerTool(
      "remove_server",
      {
        description: "Disconnect and remove an upstream MCP server.",
        inputSchema: {
          id: z.string().describe("The server ID (from list_servers)"),
        },
      },
      async ({ id }) => {
        track("remove_server");
        try {
          await this.mcp.closeConnection(id);
        } catch {
          // Already disconnected
        }
        this.sql`DELETE FROM mcp_servers WHERE id = ${id}`;
        return {
          content: [{ type: "text" as const, text: `Removed server ${id}` }],
        };
      },
    );

    this.server.registerTool(
      "list_servers",
      {
        description: "List all configured upstream MCP servers and their connection status.",
      },
      async () => {
        track("list_servers");
        const saved = this.sql<DbServer>`SELECT id, url, name FROM mcp_servers ORDER BY added`;
        const connections = this.mcp.mcpConnections;

        if (saved.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No upstream servers configured. Use add_server to connect one." }],
          };
        }

        const lines = saved.map((s) => {
          const conn = connections[s.id];
          const status = conn?.connectionState ?? "disconnected";
          const toolCount = conn?.tools?.length ?? 0;
          return `• ${s.name || s.url} (${status}, ${toolCount} tools)\n  id: ${s.id}\n  url: ${s.url}`;
        });

        return {
          content: [{ type: "text" as const, text: `Upstream servers:\n\n${lines.join("\n\n")}` }],
        };
      },
    );

    this.server.registerTool(
      "list_upstream_tools",
      {
        description: "List all tools available across connected upstream MCP servers.",
      },
      async () => {
        track("list_upstream_tools");
        const tools = this.mcp.listTools();

        if (tools.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No upstream tools available. Connect a server first with add_server." }],
          };
        }

        const lines = tools.map(
          (t) => `• ${t.name} [${t.serverId}]\n  ${t.description ?? "(no description)"}`,
        );

        return {
          content: [{ type: "text" as const, text: `Available upstream tools (${tools.length}):\n\n${lines.join("\n\n")}` }],
        };
      },
    );

    this.server.registerTool(
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
        track("call_upstream_tool");
        try {
          const result = await this.mcp.callTool({
            serverId,
            name: toolName,
            arguments: args,
          });
          return {
            content: (result.content as Array<{ type: "text"; text: string }>) ?? [
              { type: "text" as const, text: JSON.stringify(result) },
            ],
          };
        } catch (e) {
          return {
            content: [{ type: "text" as const, text: `❌ Tool call failed: ${String(e)}` }],
          };
        }
      },
    );

    // ══════════════════════════════════════════════════════════════════════
    //  Model Selection Tools
    // ══════════════════════════════════════════════════════════════════════

    this.server.registerTool(
      "set_model",
      {
        description:
          "Change the Workers AI model used for inference. Default is Llama 3.3 70B.",
        inputSchema: {
          model: z
            .string()
            .describe(
              "Workers AI model identifier, e.g. '@cf/meta/llama-3.3-70b-instruct-fp8-fast' or '@cf/meta/llama-3.1-8b-instruct'",
            ),
        },
      },
      async ({ model: newModel }) => {
        track("set_model");
        this.setState({ ...this.state, selectedModel: newModel });
        return {
          content: [{ type: "text" as const, text: `Model set to: ${newModel}` }],
        };
      },
    );

    this.server.registerTool(
      "get_model",
      {
        description: "Show the currently selected Workers AI model.",
      },
      async () => {
        track("get_model");
        return {
          content: [{ type: "text" as const, text: `Current model: ${model()}` }],
        };
      },
    );

    // ══════════════════════════════════════════════════════════════════════
    //  Built-in AI Tools
    // ══════════════════════════════════════════════════════════════════════

    this.server.registerTool(
      "ask_llm",
      {
        description:
          "Ask the LLM anything. Remembers the last 20 messages per session — supports follow-up questions, brainstorming, and explanations.",
        inputSchema: {
          question: z.string().describe("The question or prompt to answer"),
        },
      },
      async ({ question }) => {
        track("ask_llm");
        const history = loadHistory();
        saveMessage("user", question);

        const messages: Message[] = [
          { role: "system", content: PROMPTS.ask },
          ...history,
          { role: "user", content: question },
        ];
        const text = await runTool(runInference(ai, messages, model()));
        saveMessage("assistant", text);
        return { content: [{ type: "text" as const, text }] };
      },
    );

    this.server.registerTool(
      "explain_error",
      {
        description:
          "Paste an error message or stack trace and get a plain-English explanation with suggested fixes.",
        inputSchema: {
          error: z.string().describe("The error message or stack trace"),
          context: z
            .string()
            .optional()
            .describe("Optional surrounding code or context"),
        },
      },
      async ({ error, context }) => {
        track("explain_error");
        const user = context
          ? `Error:\n${error}\n\nContext:\n${context}`
          : error;
        const messages: Message[] = [
          { role: "system", content: PROMPTS.explainError },
          { role: "user", content: user },
        ];
        const text = await runTool(runInference(ai, messages, model()));
        return { content: [{ type: "text" as const, text }] };
      },
    );

    this.server.registerTool(
      "summarize",
      {
        description:
          "Summarize text, code, or documentation into a concise digest.",
        inputSchema: {
          content: z.string().describe("The text or code to summarize"),
          format: z
            .enum(["bullets", "paragraph", "tldr"])
            .optional()
            .default("bullets")
            .describe("Output format"),
        },
      },
      async ({ content, format }) => {
        track("summarize");
        const messages: Message[] = [
          { role: "system", content: PROMPTS.summarize(format ?? "bullets") },
          { role: "user", content },
        ];
        const text = await runTool(runInference(ai, messages, model()));
        return { content: [{ type: "text" as const, text }] };
      },
    );

    this.server.registerTool(
      "generate_commit",
      {
        description:
          "Generate a conventional commit message from a git diff or description of changes.",
        inputSchema: {
          diff: z
            .string()
            .describe("The git diff or description of what changed"),
        },
      },
      async ({ diff }) => {
        track("generate_commit");
        const messages: Message[] = [
          { role: "system", content: PROMPTS.generateCommit },
          { role: "user", content: diff },
        ];
        const text = await runTool(runInference(ai, messages, model()));
        return { content: [{ type: "text" as const, text }] };
      },
    );

    this.server.registerTool(
      "translate",
      {
        description: "Translate text from one language to another.",
        inputSchema: {
          text: z.string().describe("Text to translate"),
          target: z
            .string()
            .describe(
              "Target language (e.g. 'Spanish', 'French', 'Japanese')",
            ),
          source: z
            .string()
            .optional()
            .describe("Source language — auto-detected if omitted"),
        },
      },
      async ({ text, target, source }) => {
        track("translate");
        const user = source
          ? `Translate from ${source} to ${target}:\n\n${text}`
          : `Translate to ${target}:\n\n${text}`;
        const messages: Message[] = [
          { role: "system", content: PROMPTS.translate },
          { role: "user", content: user },
        ];
        const result = await runTool(runInference(ai, messages, model()));
        return { content: [{ type: "text" as const, text: result }] };
      },
    );

    this.server.registerTool(
      "review_code",
      {
        description:
          "Quick code review: spots bugs, security issues, performance problems, and style improvements.",
        inputSchema: {
          code: z.string().describe("The code to review"),
          language: z
            .string()
            .optional()
            .describe("Programming language — auto-detected if omitted"),
          focus: z
            .enum(["bugs", "security", "performance", "style", "all"])
            .optional()
            .default("all")
            .describe("What to focus on"),
        },
      },
      async ({ code, language, focus }) => {
        track("review_code");
        const lang = language ? ` (${language})` : "";
        const user = `Focus: ${focus ?? "all"}\n\nCode${lang}:\n\`\`\`\n${code}\n\`\`\``;
        const messages: Message[] = [
          { role: "system", content: PROMPTS.reviewCode },
          { role: "user", content: user },
        ];
        const text = await runTool(runInference(ai, messages, model()));
        return { content: [{ type: "text" as const, text }] };
      },
    );

    this.server.registerTool(
      "session_stats",
      {
        description:
          "Returns usage statistics for this session — tool call counts, conversation size, model, and connected servers.",
      },
      async () => {
        const counts = Object.entries(this.state.toolCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([tool, count]) => `  ${tool}: ${count}`)
          .join("\n");

        const [row] = this.sql<{ count: number }>`
          SELECT COUNT(*) as count FROM messages
        `;

        const servers = this.sql<DbServer>`SELECT id, url, name FROM mcp_servers`;
        const upstreamTools = this.mcp.listTools();

        const text =
          `Session stats:\n` +
          `  Model: ${model()}\n` +
          `  Total requests: ${this.state.totalRequests}\n` +
          `  Conversation messages stored: ${row?.count ?? 0}\n` +
          `  Upstream servers: ${servers.length}\n` +
          `  Upstream tools available: ${upstreamTools.length}\n` +
          (counts ? `\nBy tool:\n${counts}` : "");

        return { content: [{ type: "text" as const, text }] };
      },
    );
  }
}

// McpAgent.serve uses Streamable HTTP (MCP 2025 spec), compatible with
// `claude mcp add cfai --transport http https://...`
export default McpAgent.serve("/mcp", { binding: "CFAI_AGENT" });
