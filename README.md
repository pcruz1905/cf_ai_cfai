# cf_ai_cfai

A remote MCP server on Cloudflare that gives your AI coding agent (Claude Code, Cursor, Windsurf) access to **Llama 3.3 70B** for nearly free — so it stops burning your expensive tokens on simple tasks.

[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy%20to-Cloudflare-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Built with Workers AI](https://img.shields.io/badge/Workers%20AI-Llama%203.3%2070B-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers-ai/)
[![MCP](https://img.shields.io/badge/Protocol-MCP-6B21A8)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-black)](LICENSE)

---

## The Problem

Claude Code and Cursor burn expensive tokens on tasks Llama 3.3 can handle just as well:

- "Explain this error" — ~2,000 tokens
- "Summarize this file" — ~3,000 tokens
- "Write a commit message" — ~1,500 tokens

**cfai** offloads all of that to Workers AI. Your expensive model handles only the hard stuff.

---

## Architecture

```
Claude Code / Cursor / any MCP client
        │
        │  MCP over Streamable HTTP
        ▼
Cloudflare Worker ──▶ AI Gateway (1h cache + analytics)
        │                      │
        ▼                      ▼
 McpAgent (Durable Object)  Llama 3.3 70B (Workers AI)
   ├── SQLite: conversation history (last 20 msgs/session)
   └── State: per-session tool usage stats
```

| Cloudflare Primitive | Role |
|---|---|
| **Workers AI** | Llama 3.3 70B with speculative decoding (2–4× faster) |
| **McpAgent** | Durable Object that implements the MCP server protocol |
| **DO SQLite** | Persistent conversation memory across requests |
| **AI Gateway** | Semantic caching (1h TTL), rate limiting, analytics |
| **Smart Placement** | Worker auto-routes to the datacenter nearest the GPU |

---

## Tools

| Tool | What it does |
|---|---|
| `ask_llm` | Ask anything — **remembers last 20 messages** per session for follow-ups |
| `explain_error` | Paste an error/stack trace, get a plain-English fix |
| `summarize` | Summarize text/code/docs (bullets, paragraph, or TL;DR) |
| `generate_commit` | Conventional commit message from a git diff |
| `translate` | Translate between any languages |
| `review_code` | Spot bugs, security issues, performance, and style problems |
| `session_stats` | See tool call counts and conversation history size |

---

## Quick Start

### Use the deployed instance

```bash
claude mcp add cfai --transport http https://cfai-worker.<account>.workers.dev/mcp
```

Then ask Claude Code to use it:

> "Use cfai to explain this error"
> "Use ask_llm to summarize this file"

### Conversation memory

`ask_llm` persists history in SQLite inside the Durable Object. Each MCP session gets its own isolated history:

```
→ ask_llm: "What is a Cloudflare Durable Object?"
← cfai: "A Durable Object is a stateful serverless instance..."

→ ask_llm: "How does its SQLite compare to KV?"   ← follows up automatically
← cfai: "Compared to what I described, SQLite lets you..."
```

Check usage anytime:

```
→ session_stats
← Session stats:
     Total requests: 12
     Conversation messages stored: 8

   By tool:
     ask_llm: 6
     explain_error: 3
     summarize: 2
     generate_commit: 1
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

## AI Gateway Caching

Responses are cached for **1 hour**. Identical requests return instantly with zero inference cost. View cache hit rates and latency in the [AI Gateway dashboard](https://dash.cloudflare.com/?to=/:account/ai/ai-gateway).

---

## CI / CD

GitHub Actions typechecks every PR and deploys to Cloudflare on push to `main`.

Add `CLOUDFLARE_API_TOKEN` to repo Settings → Secrets → Actions.

---

## Project Structure

```text
apps/agent/
├── src/
│   ├── index.ts     # CfaiAgent (McpAgent subclass) — tools + SQLite memory
│   ├── ai.ts        # Effect-based Workers AI inference (typed errors, tracing)
│   ├── errors.ts    # WorkersAiError via Effect Schema.TaggedError
│   └── prompts.ts   # Specialized system prompts per tool
└── wrangler.jsonc   # AI + AI Gateway binding, Durable Object, migrations
```

---

## Stack

- **[Cloudflare Workers](https://workers.cloudflare.com)** — globally distributed serverless runtime
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)** — Llama 3.3 70B inference, free tier available
- **[Agents SDK](https://developers.cloudflare.com/agents/)** — `McpAgent` class handles MCP protocol
- **[Durable Objects + SQLite](https://developers.cloudflare.com/durable-objects/)** — stateful session memory
- **[AI Gateway](https://developers.cloudflare.com/ai-gateway/)** — caching, rate limiting, analytics
- **[Effect-TS](https://effect.website)** — typed errors and traced AI calls

---

## License

MIT
