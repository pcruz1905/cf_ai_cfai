import { z } from "zod";
import { Effect } from "effect";
import { textContent, runTool } from "../index.js";
import type { CfaiAgent } from "../index.js";

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
            const runHelp = Effect.fn("help")(function* () {
                yield* Effect.annotateCurrentSpan("category", category);
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

                return `cfai — MCP Gateway\n\n${text}\n\nTip: Use add_server to plug in your existing MCP servers!`;
            });

            agent.track("help");
            const text = await runTool(runHelp());
            return textContent(text);
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
            const set = Effect.fn("set_model")(function* () {
                yield* Effect.annotateCurrentSpan("model", newModel);
                agent.setState({ ...agent.state, selectedModel: newModel });
                return `Model set to: ${newModel}`;
            });

            agent.track("set_model");
            const text = await runTool(set());
            return textContent(text);
        },
    );

    agent.server.registerTool(
        "get_model",
        {
            description: "Show the currently selected Workers AI model.",
        },
        async () => {
            const get = Effect.fn("get_model")(function* () {
                return `Current model: ${agent.model()}`;
            });

            agent.track("get_model");
            const text = await runTool(get());
            return textContent(text);
        },
    );

    agent.server.registerTool(
        "session_stats",
        {
            description:
                "Returns usage statistics for this session — tool call counts, conversation size, model, and connected servers.",
        },
        async () => {
            const stats = Effect.fn("session_stats")(function* () {
                const counts = Object.entries(agent.getToolCounts())
                    .sort(([, a], [, b]) => b - a)
                    .map(([tool, count]) => `  ${tool}: ${count}`)
                    .join("\n");

                const count = agent.getMessageCount();
                const servers = agent.getServers();
                const upstreamTools = agent.mcp.listTools();

                return (
                    `Session stats:\n` +
                    `  Model: ${agent.model()}\n` +
                    `  Total requests: ${agent.getTotalRequests()}\n` +
                    `  Conversation messages stored: ${count}\n` +
                    `  Upstream servers: ${servers.length}\n` +
                    `  Upstream tools available: ${upstreamTools.length}\n` +
                    (counts ? `\nBy tool:\n${counts}` : "")
                );
            });

            agent.track("session_stats"); // Forgot to track this before, doing it now!
            const text = await runTool(stats());
            return textContent(text);
        },
    );
}
