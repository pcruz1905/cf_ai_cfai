import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect } from "effect";
import { z } from "zod";
import { runInference, type Message } from "./ai.js";
import { WorkersAiError } from "./errors.js";
import { PROMPTS } from "./prompts.js";

interface Env {
  AI: Ai;
  CFAI_AGENT: DurableObjectNamespace;
}

interface SessionState {
  totalRequests: number;
  toolCounts: Record<string, number>;
}

type DbMessage = { role: string; content: string };

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
  override initialState: SessionState = { totalRequests: 0, toolCounts: {} };
  override server = new McpServer({ name: "cfai", version: "1.0.0" });

  override async init() {
    const ai = this.env.AI;

    // ── Persistent conversation history (SQLite in Durable Object) ──────────
    this.sql`
      CREATE TABLE IF NOT EXISTS messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        role       TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
        content    TEXT    NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
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
        totalRequests: this.state.totalRequests + 1,
        toolCounts: {
          ...this.state.toolCounts,
          [tool]: (this.state.toolCounts[tool] ?? 0) + 1,
        },
      });
    };

    // ── Tools ────────────────────────────────────────────────────────────────

    this.server.registerTool(
      "ask_llm",
      {
        description:
          "Ask Llama 3.3 anything. Remembers the last 20 messages per session — supports follow-up questions, brainstorming, and explanations. Saves your expensive tokens.",
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
        const text = await runTool(runInference(ai, messages));
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
        const text = await runTool(runInference(ai, messages));
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
        const text = await runTool(runInference(ai, messages));
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
        const text = await runTool(runInference(ai, messages));
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
        const result = await runTool(runInference(ai, messages));
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
        const text = await runTool(runInference(ai, messages));
        return { content: [{ type: "text" as const, text }] };
      },
    );

    this.server.registerTool(
      "session_stats",
      {
        description:
          "Returns usage statistics for this session — tool call counts and conversation history size.",
      },
      async () => {
        const counts = Object.entries(this.state.toolCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([tool, count]) => `  ${tool}: ${count}`)
          .join("\n");

        const [row] = this.sql<{ count: number }>`
          SELECT COUNT(*) as count FROM messages
        `;

        const text =
          `Session stats:\n` +
          `  Total requests: ${this.state.totalRequests}\n` +
          `  Conversation messages stored: ${row?.count ?? 0}\n` +
          (counts ? `\nBy tool:\n${counts}` : "");

        return { content: [{ type: "text" as const, text }] };
      },
    );
  }
}

// McpAgent.serve uses Streamable HTTP (MCP 2025 spec), compatible with
// `claude mcp add cfai --transport http https://...`
export default McpAgent.serve("/mcp", { binding: "CFAI_AGENT" });
