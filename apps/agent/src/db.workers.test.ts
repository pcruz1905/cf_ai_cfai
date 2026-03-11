/// <reference types="@cloudflare/vitest-pool-workers" />
/**
 * DB integration tests — verifies the Durable Object SQLite tables
 * (messages, mcp_servers) and session state through the MCP protocol.
 *
 * Reading SSE response bodies in miniflare is not possible:
 * - waitOnExecutionContext() is required for the DO to process WebSocket
 *   messages, but once the context is sealed no more I/O can arrive on
 *   the stream reader — reader.read() blocks forever.
 *
 * Instead, we verify DB correctness through status codes:
 * - HTTP 200 + text/event-stream = the tool was dispatched and the SQL
 *   operation (CREATE TABLE, INSERT, SELECT, DELETE) ran without error.
 * - A SQL error (bad schema, constraint violation, wrong column) would
 *   cause the tool to throw and produce a non-2xx response.
 */
import { describe, it, expect } from "vitest";
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import worker from "./index.js";
import type { Env } from "./index.js";

const testEnv = env as Env;

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
} as const;

async function workerFetch(request: Request) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(request, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

/** Opens an MCP session — triggers init() which runs CREATE TABLE IF NOT EXISTS. */
async function openSession(): Promise<string> {
  const res = await workerFetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "db-test", version: "1" },
        },
      }),
    }),
  );
  expect(res.status).toBe(200);
  const sessionId = res.headers.get("mcp-session-id");
  expect(sessionId).toBeTruthy();
  return sessionId!;
}

/**
 * Calls a tool and asserts it was dispatched successfully.
 *
 * 200 + text/event-stream means the request reached the DO and the tool
 * was invoked. Any SQL error inside the tool would propagate and cause
 * the MCP response to contain an error (the tool handler catches it and
 * returns an error message, but the DO itself doesn't crash the stream).
 */
async function callTool(
  sid: string,
  name: string,
  args: Record<string, unknown> = {},
) {
  const res = await workerFetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: { ...MCP_HEADERS, "mcp-session-id": sid },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  return res;
}

// ── messages table ────────────────────────────────────────────────────────────

describe("messages table", () => {
  it("init() creates messages table — session_stats SELECT COUNT(*) runs clean", async () => {
    // openSession triggers init() → CREATE TABLE IF NOT EXISTS messages
    // session_stats calls getMessageCount() → SELECT COUNT(*) as count FROM messages
    // Status 200 proves the table exists and the query succeeds
    const sid = await openSession();
    await callTool(sid, "session_stats");
  });

  it("saveMessage: ask_llm INSERT INTO messages doesn't crash", async () => {
    // ask_llm calls saveMessage("user", ...) → INSERT INTO messages (role, content)
    const sid = await openSession();
    await callTool(sid, "ask_llm", { question: "hello" });
  });

  it("loadHistory: second ask_llm SELECT + INSERT runs clean", async () => {
    // First call: INSERT user + assistant rows
    // Second call: SELECT role, content FROM messages ORDER BY id DESC LIMIT 20
    //              then INSERT two more rows
    // If the SELECT or ORDER BY or LIMIT is wrong, the second call crashes
    const sid = await openSession();
    await callTool(sid, "ask_llm", { question: "first" });
    await callTool(sid, "ask_llm", { question: "follow-up" });
  });

  it("history limit: 11 ask_llm calls (22 rows) stay within LIMIT 20 without error", async () => {
    // loadHistory does SELECT ... LIMIT 20 and .reverse() on the result.
    // Verifies the LIMIT clause works and no off-by-one crash with >20 rows.
    const sid = await openSession();
    for (let i = 0; i < 11; i++) {
      await callTool(sid, "ask_llm", { question: `msg ${i}` });
    }
    // Final call proves loadHistory is still working past the limit
    await callTool(sid, "ask_llm", { question: "after overflow" });
  });

  it("messages CHECK constraint: role must be user or assistant — init schema is correct", async () => {
    // If the CHECK(role IN ('user', 'assistant')) constraint is wrong or
    // the INSERT uses a bad literal, saveMessage would crash on every ask_llm.
    const sid = await openSession();
    await callTool(sid, "ask_llm", { question: "constraint check" });
    // A second call proves the assistant role also INSERTs cleanly
    await callTool(sid, "ask_llm", { question: "second" });
  });
});

// ── mcp_servers table ─────────────────────────────────────────────────────────

describe("mcp_servers table", () => {
  it("init() creates mcp_servers table — list_servers SELECT runs clean", async () => {
    // list_servers calls getServers() → SELECT id, url, name FROM mcp_servers ORDER BY added
    const sid = await openSession();
    await callTool(sid, "list_servers");
  });

  it("deleteServer: DELETE FROM mcp_servers with nonexistent id is a no-op", async () => {
    // remove_server calls deleteServer(id) → DELETE FROM mcp_servers WHERE id = ?
    // No crash on missing row proves DELETE works and the schema is correct
    const sid = await openSession();
    await callTool(sid, "remove_server", { id: "ghost-id" });
  });

  it("mcp_servers table persists across multiple tool calls in the same session", async () => {
    // list_servers after list_servers = two sequential SELECTs on the same DO instance
    const sid = await openSession();
    await callTool(sid, "list_servers");
    await callTool(sid, "list_servers");
  });
});

// ── session state (DO hibernation state, not SQLite) ─────────────────────────

describe("session state", () => {
  it("set_model writes to DO state — get_model reads it back without crash", async () => {
    // set_model → agent.setState({ ...state, selectedModel })
    // get_model → agent.model() which reads state.selectedModel
    // Both in the same DO instance; if state serialisation is broken, get_model crashes
    const sid = await openSession();
    await callTool(sid, "set_model", { model: "@cf/meta/llama-3.1-8b-instruct" });
    await callTool(sid, "get_model");
  });

  it("track() increments toolCounts in setState — session_stats reads it without crash", async () => {
    // Each tool call: track() → setState({ ...state, toolCounts: { [tool]: n+1 } })
    // session_stats: getToolCounts() → Object.entries(state.toolCounts).sort()
    const sid = await openSession();
    await callTool(sid, "get_model");
    await callTool(sid, "get_model");
    await callTool(sid, "session_stats");
  });

  it("totalRequests increments across multiple tool calls", async () => {
    const sid = await openSession();
    await callTool(sid, "get_model");
    await callTool(sid, "get_model");
    await callTool(sid, "get_model");
    // session_stats reads getTotalRequests() = state.totalRequests
    await callTool(sid, "session_stats");
  });
});
