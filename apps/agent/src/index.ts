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
    //  Help / Onboarding
    // ══════════════════════════════════════════════════════════════════════

    this.server.registerTool(
      "help",
      {
        description:
          "Show all available tools with descriptions and examples. Start here!",
        inputSchema: {
          category: z
            .enum(["all", "ai", "gateway", "model"])
            .optional()
            .default("all")
            .describe("Filter by category: all, ai, gateway, or model"),
        },
      },
      async ({ category }) => {
        track("help");

        const sections: Record<string, string> = {
          ai: `🤖 AI Tools (powered by Workers AI)
  • ask_llm       — Ask anything (remembers last 20 messages)
                    Example: ask_llm { "question": "What is a Durable Object?" }
  • explain_error — Explain an error with suggested fixes
                    Example: explain_error { "error": "TypeError: x is not a function" }
  • summarize     — Summarize text/code/docs
                    Example: summarize { "content": "...", "format": "bullets" }
  • generate_commit — Commit message from a diff
                    Example: generate_commit { "diff": "+ console.log('hi')" }
  • translate     — Translate between languages
                    Example: translate { "text": "Hello", "target": "Spanish" }
  • review_code   — Code review for bugs, security, perf, style
                    Example: review_code { "code": "...", "focus": "security" }`,

          gateway: `🔌 Gateway (aggregate upstream MCP servers)
  • add_server    — Connect a server by URL
                    Example: add_server { "url": "https://mcp.example.com/sse", "name": "My Server" }
  • remove_server — Disconnect and remove
                    Example: remove_server { "id": "abc123" }
  • list_servers  — Show all connected servers
  • list_upstream_tools — List tools from all connected servers
  • call_upstream_tool  — Call a tool on an upstream server
                    Example: call_upstream_tool { "serverId": "abc123", "toolName": "list_repos" }`,

          model: `⚙️ Model & Session
  • set_model     — Switch Workers AI model
                    Example: set_model { "model": "@cf/meta/llama-3.1-8b-instruct" }
  • get_model     — Show current model
  • session_stats — Usage stats, model, connected servers`,
        };

        const cats = category === "all" ? ["ai", "gateway", "model"] : [category!];
        const text = cats.map((c) => sections[c]).join("\n\n");

        return {
          content: [{ type: "text" as const, text: `cfai — MCP Gateway\n\n${text}\n\nTip: Use add_server to plug in your existing MCP servers!` }],
        };
      },
    );

    // ══════════════════════════════════════════════════════════════════════
    //  MCP Server Management Tools
    // ══════════════════════════════════════════════════════════════════════

    const PRESETS: Record<string, { url: string; name: string; description: string }> = {
      github: {
        url: "https://api.githubcopilot.com/mcp/",
        name: "GitHub",
        description: "GitHub Copilot MCP — repos, issues, PRs, code search",
      },
      // Add more presets here as the ecosystem grows
    };

    this.server.registerTool(
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
        track("add_server");

        let serverUrl: string;
        let label: string;

        if (preset) {
          const p = PRESETS[preset.toLowerCase()];
          if (!p) {
            const available = Object.entries(PRESETS)
              .map(([k, v]) => `  • ${k} — ${v.description}`)
              .join("\n");
            return {
              content: [{ type: "text" as const, text: `Unknown preset "${preset}". Available presets:\n${available}` }],
            };
          }
          serverUrl = p.url;
          label = name ?? p.name;
        } else if (url) {
          serverUrl = url;
          label = name ?? new URL(url).hostname;
        } else {
          return {
            content: [{ type: "text" as const, text: "Provide either a 'url' or a 'preset' name. Use help { \"category\": \"gateway\" } for examples." }],
          };
        }

        try {
          const { id } = await this.mcp.connect(serverUrl);
          this.sql`INSERT OR REPLACE INTO mcp_servers (id, url, name) VALUES (${id}, ${serverUrl}, ${label})`;

          // Show the user what they just got
          const conn = this.mcp.mcpConnections[id];
          const tools = conn?.tools ?? [];
          const toolList = tools.length > 0
            ? tools.map((t) => `  • ${t.name}${t.description ? ` — ${t.description}` : ""}`).join("\n")
            : "  (no tools discovered yet)";

          return {
            content: [{
              type: "text" as const,
              text: `✅ Connected to "${label}"\n` +
                `   Server ID: ${id}\n\n` +
                `Tools discovered (${tools.length}):\n${toolList}\n\n` +
                `Use call_upstream_tool { "serverId": "${id}", "toolName": "..." } to invoke them.`,
            }],
          };
        } catch (e) {
          const hint = preset
            ? ""
            : "\n\nTip: Make sure the URL points to an MCP server's SSE or Streamable HTTP endpoint.";
          return {
            content: [{ type: "text" as const, text: `❌ Failed to connect to ${label}: ${String(e)}${hint}` }],
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
