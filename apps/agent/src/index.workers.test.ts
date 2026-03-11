/// <reference types="@cloudflare/vitest-pool-workers" />
import { describe, it, expect } from "vitest";
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import worker from "./index.js";
import type { Env } from "./index.js";

/**
 * Workers integration tests — run with: pnpm test:workers
 *
 * These run inside the real Cloudflare Workers runtime (miniflare) so bindings,
 * Durable Objects, and routing all behave as they would in production.
 *
 * Workers AI is NOT called (miniflare intercepts the binding) so no tokens are
 * consumed and no API key is needed.
 *
 * Tip: McpAgent.serve returns SSE streams for successful MCP requests.
 * In miniflare, SSE response bodies are open streams that only close after the
 * WebSocket exchange completes. We test status codes and headers only for
 * streaming responses, and read the body for synchronous error responses.
 */

// Miniflare's ProvidedEnv contains all bindings declared in wrangler.test.jsonc.
// We narrow it to our Env type for proper type checking.
const testEnv = env as Env;

async function workerFetch(request: Request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, testEnv, ctx);
  // waitOnExecutionContext returns without blocking on open SSE streams.
  // For non-streaming error responses the body is immediately readable after.
  await waitOnExecutionContext(ctx);
  return response;
}

// Reads the body — only safe for non-SSE (error/short) responses.
async function workerFetchText(request: Request) {
  const response = await workerFetch(request);
  return { status: response.status, headers: response.headers, body: await response.text() };
}

// ── Routing ──────────────────────────────────────────────────────────────────

describe("Worker routing", () => {
  it("handles OPTIONS /mcp (CORS preflight)", async () => {
    const res = await workerFetch(
      new Request("http://localhost/mcp", {
        method: "OPTIONS",
        headers: { origin: "https://example.com" },
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
  });

  it("returns 405 for GET /mcp (non-POST not allowed)", async () => {
    const { status } = await workerFetchText(
      new Request("http://localhost/mcp", { method: "GET" }),
    );
    expect(status).toBe(405);
  });

  it("returns 406 when Accept header is missing required media types", async () => {
    const { status, body } = await workerFetchText(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/html" },
        body: "{}",
      }),
    );
    expect(status).toBe(406);
    expect(body).toContain("Not Acceptable");
  });

  it("returns 415 when Content-Type is not application/json", async () => {
    const { status, body } = await workerFetchText(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          accept: "application/json, text/event-stream",
        },
        body: "hello",
      }),
    );
    expect(status).toBe(415);
    expect(body).toContain("Unsupported Media Type");
  });

  it("returns 400 for malformed JSON body", async () => {
    const { status } = await workerFetchText(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: "not-json{{{",
      }),
    );
    expect(status).toBe(400);
  });
});

// ── MCP initialize ────────────────────────────────────────────────────────────

describe("MCP initialize", () => {
  const initBody = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0.0.1" },
    },
  });

  const mcpHeaders = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };

  it("returns 200 with mcp-session-id and SSE content-type", async () => {
    const res = await workerFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: mcpHeaders,
        body: initBody,
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("mcp-session-id")).toBeTruthy();
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("returns 400 when re-initializing with an existing session ID", async () => {
    // Initialize to get a session ID
    const first = await workerFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: mcpHeaders,
        body: initBody,
      }),
    );
    const sessionId = first.headers.get("mcp-session-id")!;
    expect(sessionId).toBeTruthy();

    // Re-initialize with the session ID must fail per MCP spec
    const { status, body } = await workerFetchText(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { ...mcpHeaders, "mcp-session-id": sessionId },
        body: initBody,
      }),
    );
    expect(status).toBe(400);
    expect(body).toContain("must not include a sessionId");
  });

  it("returns 400 when sending non-initialize method without a session ID", async () => {
    const { status, body } = await workerFetchText(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: mcpHeaders,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      }),
    );
    expect(status).toBe(400);
    expect(body).toContain("Mcp-Session-Id header is required");
  });
});

// ── MCP Tools ────────────────────────────────────────────────────────────────

describe("MCP tools execution", () => {
  const mcpHeaders = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };

  /**
   * Helper: initialise a session and call a tool in one go.
   *
   * McpAgent.serve (Streamable HTTP) creates a **new** SSE stream per POST.
   * - POST without `mcp-session-id` + an `initialize` body → creates a session
   *     and returns `mcp-session-id` in the response header.
   * - POST with `mcp-session-id` + a `tools/call` body → runs the tool and
   *     returns the JSON-RPC result via SSE.
   *
   * In miniflare the DO storage only lives within a single execution context,
   * so we must initialise **and** call the tool inside the same test.
   */
  async function initAndCallTool(
    toolName: string,
    args: Record<string, unknown> = {},
  ) {
    // 1. Initialise
    const initRes = await workerFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: mcpHeaders,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "vitest", version: "0.0.1" },
          },
        }),
      }),
    );

    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    // 2. Call the tool using the session we just created
    const toolRes = await workerFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          ...mcpHeaders,
          "mcp-session-id": sessionId!,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: toolName, arguments: args },
        }),
      }),
    );

    // A successful tool invocation returns 200 with an SSE stream.
    // Protocol-level errors (bad session, bad method) return 4xx **before**
    // the stream is created, so a 200 here proves the tool was dispatched.
    expect(toolRes.status).toBe(200);
    expect(toolRes.headers.get("content-type")).toContain("text/event-stream");
    return toolRes;
  }

  it("calls ask_llm successfully", async () => {
    await initAndCallTool("ask_llm", { question: "What is 1+1?" });
  });

  it("calls explain_error successfully", async () => {
    await initAndCallTool("explain_error", {
      error: "SyntaxError: Unexpected token",
      context: "const x =",
    });
  });

  it("calls summarize successfully", async () => {
    await initAndCallTool("summarize", {
      content: "Long text that needs summarising.",
      format: "bullets",
    });
  });

  it("calls generate_commit successfully", async () => {
    await initAndCallTool("generate_commit", {
      diff: "+ console.log('hello world')",
    });
  });

  it("calls translate successfully", async () => {
    await initAndCallTool("translate", {
      text: "Hello",
      target: "Spanish",
      source: "English",
    });
  });

  it("calls review_code successfully", async () => {
    await initAndCallTool("review_code", {
      code: "function fn() { return; }",
      language: "javascript",
      focus: "style",
    });
  });

  it("calls session_stats successfully", async () => {
    await initAndCallTool("session_stats");
  });

  // ── Gateway Management Tools ──────────────────────────────────────────

  it("calls list_servers successfully (empty list)", async () => {
    await initAndCallTool("list_servers");
  });

  it("calls list_upstream_tools successfully (empty)", async () => {
    await initAndCallTool("list_upstream_tools");
  });

  it("calls set_model successfully", async () => {
    await initAndCallTool("set_model", {
      model: "@cf/meta/llama-3.1-8b-instruct",
    });
  });

  it("calls get_model successfully", async () => {
    await initAndCallTool("get_model");
  });

  // ── Help & Onboarding ─────────────────────────────────────────────────

  it("calls help with default 'all' category", async () => {
    await initAndCallTool("help");
  });

  it("calls help filtered to 'gateway' category", async () => {
    await initAndCallTool("help", { category: "gateway" });
  });

  it("calls help filtered to 'model' category", async () => {
    await initAndCallTool("help", { category: "model" });
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  it("calls add_server with no params (returns guidance)", async () => {
    await initAndCallTool("add_server", {});
  });

  it("calls remove_server with nonexistent id (no crash)", async () => {
    await initAndCallTool("remove_server", { id: "nonexistent-id" });
  });
});
