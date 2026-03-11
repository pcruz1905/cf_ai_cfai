import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect } from "effect";
import { DEFAULT_MODEL, type Message } from "./ai.js";
import { connectServer } from "./utils.js";

import { registerAiTools } from "./tools/ai.js";
import { registerGatewayTools } from "./tools/gateway.js";
import { registerSystemTools } from "./tools/system.js";

export const RATE_LIMIT = 60;
export const RATE_WINDOW_MS = 60_000;

export interface Env {
  AI: Ai;
  CFAI_AGENT: DurableObjectNamespace;
}

export interface SessionState {
  totalRequests: number;
  toolCounts: Record<string, number>;
  selectedModel: string;
}

export type MessageRole = "user" | "assistant";
export type DbMessage = { role: MessageRole; content: string };
export type DbServer = { id: string; url: string; name: string };

export class CfaiAgent extends McpAgent<Env, SessionState> {
  override initialState: SessionState = {
    totalRequests: 0,
    toolCounts: {},
    selectedModel: DEFAULT_MODEL,
  };
  override server = new McpServer({ name: "cfai", version: "1.0.0" });

  private callTimestamps: number[] = [];

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === "string" && message === "ping") {
      ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
    }
  }

  override async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    ws.close(code, reason);
  }

  override async webSocketError(ws: WebSocket, error: unknown) {
    ws.close(1011, "Unexpected error");
  }

  broadcast(data: Record<string, unknown>) {
    const msg = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(msg); } catch { /* client gone */ }
    }
  }

  track(tool: string) {
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (this.callTimestamps.length >= RATE_LIMIT) {
      throw new Error(`Rate limit exceeded: max ${RATE_LIMIT} tool calls per minute. Try again shortly.`);
    }
    this.callTimestamps.push(now);

    this.setState({
      ...this.state,
      totalRequests: this.state.totalRequests + 1,
      toolCounts: {
        ...this.state.toolCounts,
        [tool]: (this.state.toolCounts[tool] ?? 0) + 1,
      },
    });
  }

  loadHistory(): Message[] {
    return this.sql<DbMessage>`
      SELECT role, content FROM messages ORDER BY id DESC LIMIT 20
    `
      .reverse()
      .map((r) => ({ role: r.role, content: r.content }));
  }

  saveMessage(role: MessageRole, content: string) {
    this.sql`INSERT INTO messages (role, content) VALUES (${role}, ${content})`;
  }

  model() {
    return this.state.selectedModel ?? DEFAULT_MODEL;
  }

  getServers(): DbServer[] {
    return this.sql<DbServer>`SELECT id, url, name FROM mcp_servers ORDER BY added`;
  }

  saveServer(id: string, url: string, name: string) {
    this.sql`INSERT OR REPLACE INTO mcp_servers (id, url, name) VALUES (${id}, ${url}, ${name})`;
  }

  deleteServer(id: string) {
    this.sql`DELETE FROM mcp_servers WHERE id = ${id}`;
  }

  getToolCounts() {
    return this.state.toolCounts;
  }

  getTotalRequests() {
    return this.state.totalRequests;
  }

  getMessageCount() {
    const [row] = this.sql<{ count: number }>`SELECT COUNT(*) as count FROM messages`;
    return row?.count ?? 0;
  }

  get ai() {
    return this.env.AI;
  }

  override async init() {
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

    const savedServers = this.getServers();
    for (const srv of savedServers) {
      await Effect.runPromise(
        connectServer(this.mcp, srv.url).pipe(
          Effect.catchAll(() => Effect.succeed(undefined)),
        ),
      );
    }

    registerSystemTools(this);
    registerGatewayTools(this);
    registerAiTools(this);
  }
}

const mcpHandler = McpAgent.serve("/mcp", { binding: "CFAI_AGENT" });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }
      const id = env.CFAI_AGENT.idFromName("ws-status");
      const stub = env.CFAI_AGENT.get(id);
      return stub.fetch(request);
    }

    return mcpHandler.fetch(request, env, ctx);
  },
};
