# cfai

> A remote MCP server that gives your AI agent cheap brains — backed by Llama 3.3 on Cloudflare Workers AI.

[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy%20to-Cloudflare-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Built with Workers AI](https://img.shields.io/badge/Workers%20AI-Llama%203.3%2070B-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers-ai/)
[![MCP](https://img.shields.io/badge/Protocol-MCP-6B21A8)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-black)](LICENSE)

---

## The problem

Claude Code and Cursor burn expensive tokens on simple tasks — explaining errors, writing commit messages, summarizing files, translating text. Stuff a free model handles just fine.

## The solution

`cfai` is a remote MCP server on Cloudflare. Your AI agent calls it for cheap tasks. Llama 3.3 70B handles them. Your expensive tokens stay reserved for the hard stuff.

```
Your agent sees a task
  → "this looks simple"
    → calls cfai.explain_error via MCP
      → Llama 3.3 70B answers on Cloudflare
        → answer comes back
          → your tokens: untouched
```

---

## Setup

Add `cfai` to Claude Code in one command:

```bash
claude mcp add cfai --transport sse https://cfai.<your-name>.workers.dev/mcp
```

That's it. Your agent now has access to six new tools backed by free inference.

---

## Tools

| Tool | What it does |
|---|---|
| `ask_llm` | General questions, explanations, anything |
| `explain_error` | Paste an error, get a diagnosis and fix |
| `summarize` | Summarize text, code, docs, diffs |
| `generate_commit` | Generate a commit message from a diff |
| `translate` | Translate between any languages |
| `review_code` | Quick code review with actionable feedback |

---

## Architecture

```
Claude Code / Cursor / Any MCP Client
         │
         │  MCP over Streamable HTTP
         ▼
 ┌─────────────────────────────────┐
 │     Cloudflare Worker           │
 │                                 │
 │  ┌──────────────────────────┐   │
 │  │  McpAgent (Agents SDK)   │   │
 │  │                          │   │
 │  │  ask_llm        ──────────────▶ Llama 3.3 70B
 │  │  explain_error  ──────────────▶ Llama 3.3 70B
 │  │  summarize      ──────────────▶ Llama 3.3 70B
 │  │  generate_commit ─────────────▶ Llama 3.3 70B
 │  │  translate      ──────────────▶ Llama 3.3 70B
 │  │  review_code    ──────────────▶ Llama 3.3 70B
 │  └──────────────────────────┘   │
 │                                 │
 │  Durable Object ─ session state │
 │  AI Gateway ─ caching + logs    │
 └─────────────────────────────────┘
```

---

## Project structure

```
apps/agent/
├── src/
│   ├── index.ts          # Worker entry + MCP server setup
│   ├── tools.ts          # Tool definitions
│   ├── prompts.ts        # Specialized system prompts per tool
│   └── session.ts        # Durable Object — memory + usage stats
├── wrangler.jsonc        # AI binding, Durable Object, AI Gateway
└── package.json
```

---

## Deploy your own

```bash
# 1. Clone
git clone https://github.com/your-name/cfai
cd cfai

# 2. Install
pnpm install

# 3. Deploy
pnpm deploy
```

Then add it to your agent:

```bash
claude mcp add cfai --transport sse https://cfai.<your-name>.workers.dev/mcp
```

---

## Stack

- **[Cloudflare Workers](https://workers.cloudflare.com)** — serverless runtime, globally distributed
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)** — Llama 3.3 70B inference, free tier available
- **[Agents SDK](https://developers.cloudflare.com/agents/)** — `McpAgent` class, handles MCP protocol
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** — session state, usage tracking
- **[AI Gateway](https://developers.cloudflare.com/ai-gateway/)** — caching, logging, analytics

---

## License

MIT
