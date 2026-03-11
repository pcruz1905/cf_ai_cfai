import { z } from "zod";
import { Effect } from "effect";
import { textContent, runTool } from "../utils.js";
import type { CfaiAgent } from "../index.js";

const HELP_SECTIONS = {
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
} as const;

type HelpCategory = "all" | "ai" | "gateway" | "model";

const helpText = Effect.fn("help")(function* (category: HelpCategory) {
  yield* Effect.annotateCurrentSpan("category", category);
  const cats =
    category === "all"
      ? (["ai", "gateway", "model"] as const)
      : ([category] as const);
  const text = cats.map((c) => HELP_SECTIONS[c]).join("\n\n");
  return `cfai — MCP Gateway\n\n${text}\n\nTip: Use add_server to plug in your existing MCP servers!`;
});

const setModel = Effect.fn("set_model")(function* (
  agent: CfaiAgent,
  model: string,
) {
  yield* Effect.annotateCurrentSpan("model", model);
  agent.setState({ ...agent.state, selectedModel: model });
  return `Model set to: ${model}`;
});

export function registerSystemTools(agent: CfaiAgent) {
  agent.server.registerTool(
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
      agent.track("help");
      return textContent(await runTool(helpText(category ?? "all")));
    },
  );

  agent.server.registerTool(
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
      agent.track("set_model");
      return textContent(await runTool(setModel(agent, newModel)));
    },
  );

  agent.server.registerTool(
    "get_model",
    {
      description: "Show the currently selected Workers AI model.",
    },
    async () => {
      agent.track("get_model");
      return textContent(`Current model: ${agent.model()}`);
    },
  );

  agent.server.registerTool(
    "session_stats",
    {
      description:
        "Returns usage statistics for this session — tool call counts, conversation size, model, and connected servers.",
    },
    async () => {
      agent.track("session_stats");
      const counts = Object.entries(agent.getToolCounts())
        .sort(([, a], [, b]) => b - a)
        .map(([tool, count]) => `  ${tool}: ${count}`)
        .join("\n");
      const servers = agent.getServers();
      return textContent(
        `Session stats:\n` +
          `  Model: ${agent.model()}\n` +
          `  Total requests: ${agent.getTotalRequests()}\n` +
          `  Conversation messages stored: ${agent.getMessageCount()}\n` +
          `  Upstream servers: ${servers.length}\n` +
          `  Upstream tools available: ${agent.mcp.listTools().length}\n` +
          (counts ? `\nBy tool:\n${counts}` : ""),
      );
    },
  );
}
