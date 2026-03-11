# cfai — MCP Gateway on Cloudflare

Your **single MCP server** that aggregates all your other MCP servers — so you connect once instead of 30 times. Powered by **Llama 3.3 70B** on Workers AI with switchable models.

[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy%20to-Cloudflare-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Built with Workers AI](https://img.shields.io/badge/Workers%20AI-Llama%203.3%2070B-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers-ai/)
[![MCP](https://img.shields.io/badge/Protocol-MCP-6B21A8)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-black)](LICENSE)

---

## Why?

**Problem:** You have 30 MCP servers. Each coding agent (Claude Code, Cursor, Windsurf) needs them all configured individually. And simple tasks like "explain this error" burn your expensive tokens.

**Solution:** cfai is a single MCP gateway that:

1. **Aggregates MCP servers** — plug in any number of upstream servers, their tools appear as your tools
2. **Saves your tokens** — built-in AI tools offload simple tasks to Llama 3.3 (nearly free on Workers AI)
3. **Lets you pick the model** — switch between any Workers AI model at runtime

---

## Architecture

```
Claude Code / Cursor / any MCP client
        │
        │  MCP over Streamable HTTP
        ▼
  ┌─────────────────────────────────┐
  │  cfai-agent (Durable Object)    │
  │  ┌───────────┐  ┌────────────┐  │
  │  │ Built-in  │  │  Gateway   │  │
  │  │ AI Tools  │  │  Manager   │  │
  │  └─────┬─────┘  └─────┬──────┘  │
  │        │               │         │
  │    Workers AI    MCP Server 1    │
  │  (configurable   MCP Server 2    │
  │    model)        MCP Server N    │
  │                                  │
  │  SQLite: messages, servers,      │
  │          model prefs, stats      │
  └──────────────────────────────────┘
```

| Cloudflare Primitive | Role |
|---|---|
| **Workers AI** | Llama 3.3 70B (default) — switchable to any model |
| **McpAgent** | Durable Object: MCP server + upstream client manager |
| **DO SQLite** | Persistent conversation history, server registry, model preferences |
| **AI Gateway** | Semantic caching (1h TTL), rate limiting, analytics |
| **Smart Placement** | Auto-routes to the datacenter nearest the GPU |

---

## Tools

### Built-in AI Tools

| Tool | What it does |
|---|---|
| `ask_llm` | Ask anything — **remembers last 20 messages** per session |
| `explain_error` | Paste an error/stack trace, get a plain-English fix |
| `summarize` | Summarize text/code/docs (bullets, paragraph, or TL;DR) |
| `generate_commit` | Conventional commit message from a git diff |
| `translate` | Translate between any languages |
| `review_code` | Spot bugs, security issues, performance, and style problems |

### Gateway Management

| Tool | What it does |
|---|---|
| `add_server` | Connect an upstream MCP server by URL |
| `remove_server` | Disconnect and remove a server |
| `list_servers` | Show all configured servers + connection status |
| `list_upstream_tools` | List tools available across all connected servers |
| `call_upstream_tool` | Proxy a tool call to an upstream server |

### Model & Session

| Tool | What it does |
|---|---|
| `set_model` | Switch Workers AI model (e.g. Llama 3.1 8B for speed) |
| `get_model` | Show current model |
| `session_stats` | Tool call counts, messages, connected servers, model |

---

## Quick Start

### 1. Connect

```bash
claude mcp add cfai --transport http https://cfai-worker.<account>.workers.dev/mcp
```

### 2. Use built-in tools

> "Use cfai to explain this error"
> "Use ask_llm to summarize this file"

### 3. Plug in your MCP servers

```
→ add_server: { "url": "https://my-github-mcp.example.com/sse", "name": "GitHub" }
← ✅ Connected to "GitHub" (id: abc123)

→ list_upstream_tools
← Available upstream tools (12):
    • create_issue [abc123]
    • list_repos [abc123]
    ...

→ call_upstream_tool: { "serverId": "abc123", "toolName": "list_repos", "args": {} }
← [list of repos]
```

Your server configs persist — they auto-reconnect on startup.

### 4. Switch models

```
→ set_model: { "model": "@cf/meta/llama-3.1-8b-instruct" }
← Model set to: @cf/meta/llama-3.1-8b-instruct

→ get_model
← Current model: @cf/meta/llama-3.1-8b-instruct
```

---

## Run Locally

```bash
# Prerequisites: Node 22+, pnpm, wrangler
git clone https://github.com/your-username/cf_ai_cfai
cd cf_ai_cfai
pnpm install
pnpm dev
```

Server runs at `http://localhost:8787/mcp`.

```bash
claude mcp add cfai-local --transport http http://localhost:8787/mcp
```

---

## Deploy Your Own

**1. Authenticate:**

```bash
wrangler login
```

**2. Create the AI Gateway** (enables caching + analytics):

- Cloudflare Dashboard → AI → AI Gateway
- Create a gateway named exactly **`cfai-gateway`**

**3. Deploy:**

```bash
pnpm deploy
```

**4. Connect:**

```bash
claude mcp add cfai --transport http https://cfai-worker.<your-account>.workers.dev/mcp
```

---

## CI / CD

GitHub Actions typechecks every PR and deploys to Cloudflare on push to `main`.

Add `CLOUDFLARE_API_TOKEN` to repo Settings → Secrets → Actions.

---

## Project Structure

```text
apps/agent/
├── src/
│   ├── index.ts     # CfaiAgent — gateway tools, server aggregation, model selection
│   ├── ai.ts        # Effect-based inference with configurable model
│   ├── errors.ts    # WorkersAiError via Effect Schema.TaggedError
│   └── prompts.ts   # Specialized system prompts per tool
├── wrangler.jsonc   # AI Gateway binding, Durable Object, migrations
└── wrangler.test.jsonc  # Test config (no AI binding for CI)
```

---

## Stack

- **[Cloudflare Workers](https://workers.cloudflare.com)** — globally distributed serverless runtime
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)** — Llama 3.3 70B inference, free tier available
- **[Agents SDK](https://developers.cloudflare.com/agents/)** — `McpAgent` + `MCPClientManager` for server aggregation
- **[Durable Objects + SQLite](https://developers.cloudflare.com/durable-objects/)** — stateful session memory + server registry
- **[AI Gateway](https://developers.cloudflare.com/ai-gateway/)** — caching, rate limiting, analytics
- **[Effect-TS](https://effect.website)** — typed errors and traced AI calls

---

## License

MIT
