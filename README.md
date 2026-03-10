# cfai — CLI AI Assistant with Persistent Memory

A terminal-native AI assistant powered by **Llama 3.3 70B** on Cloudflare Workers AI. Ask questions, pipe errors for fixes, and get answers tailored to your tech stack — all from your terminal with streaming responses.

The killer feature: **it remembers you**. Your tech stack, preferences, and conversation history persist across sessions via Durable Objects with SQLite storage.

## Architecture

```
cfai (npm CLI)           Cloudflare Worker            Durable Object
┌──────────────┐        ┌─────────────────┐         ┌────────────────┐
│  Node.js CLI │──SSE──▶│  /api/ask       │────────▶│  UserSession   │
│  commander   │        │  /api/config    │         │  ┌──────────┐  │
│  cli-tui     │        │  /api/history   │         │  │ SQLite   │  │
│              │        │  /api/clear     │         │  │ messages │  │
└──────────────┘        │                 │         │  │ profile  │  │
                        │  Workers AI     │         │  └──────────┘  │
                        │  Llama 3.3 70B  │         └────────────────┘
                        └─────────────────┘
```

### Components

| Component | Tech | Purpose |
|-----------|------|---------|
| **Worker** | Cloudflare Workers | HTTP API, SSE streaming, auth, AI orchestration |
| **LLM** | Llama 3.3 70B (Workers AI) | Inference via `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| **State** | Durable Objects + SQLite | Per-user chat history & profile storage |
| **CLI** | Node.js + commander + cli-tui | Terminal interface with colored output & spinners |
| **Coordination** | Durable Objects | Session management, message storage, profile-aware prompts |

## Features

### Ask questions
```bash
cfai ask "why is my docker build failing?"
```

### Pipe errors for fixes
```bash
cat error.log | cfai fix
npm test 2>&1 | cfai fix
```

### Attach files for context
```bash
cfai ask "explain this code" -f ./src/index.ts
```

### Persistent user profile
```bash
cfai config set stack "TypeScript, Effect-TS, Cloudflare Workers"
cfai config set editor "VS Code"
cfai config set os "macOS"
cfai config get
```

Responses are automatically tailored to your configured stack, editor, and preferences.

### Chat history
```bash
cfai history     # see past conversations
cfai clear       # wipe all memory
```

### Streaming responses (SSE)
Answers stream token-by-token to your terminal, with animated spinners while waiting and a formatted response display.

## Project Structure

```
cfai-monorepo/
├── worker/              # Cloudflare Worker (API + Durable Objects)
│   ├── src/
│   │   ├── index.ts     # HTTP routes, SSE streaming, AI calls
│   │   ├── session.ts   # UserSession Durable Object (SQLite)
│   │   └── prompts.ts   # System prompt builder with profile context
│   └── wrangler.jsonc   # Worker config (AI binding, DO, migrations)
├── cli/                 # Node.js CLI tool
│   ├── src/
│   │   ├── index.ts     # Commander.js commands (ask, fix, config, etc.)
│   │   ├── client.ts    # HTTP client with SSE stream parsing
│   │   ├── auth.ts      # Token management (~/.cfai/config.json)
│   │   └── ui.ts        # TUI helpers (spinners, colors, boxes, tables)
│   └── tsup.config.ts   # Bundle config
├── cli-tui/             # Terminal UI component library
│   └── src/             # Colors, spinners, boxes, tables, progress bars
├── tsconfig.base.json   # Shared TypeScript config
└── pnpm-workspace.yaml  # Monorepo with version catalog
```

## How It Works

### Memory & State (Durable Objects + SQLite)

Each user gets a unique `UserSession` Durable Object keyed by their auth token. Inside, a SQLite database stores:

- **`messages`** — Full chat history (role, content, timestamp), used to maintain conversation context across requests
- **`profile`** — Key-value pairs (stack, OS, editor, etc.) injected into the system prompt so the LLM tailors responses

The system prompt is dynamically built from the user's profile, and the last 20 messages are included as conversation context.

### Streaming (SSE)

When the CLI sends a question to `/api/ask`:

1. Worker loads user profile + chat history from the Durable Object
2. Builds a context-aware prompt with system instructions + profile + history
3. Calls Workers AI (`Llama 3.3 70B`) with `stream: true`
4. Tees the response stream — one copy streams to the client via SSE, the other is collected and stored in the Durable Object
5. CLI parses SSE events and renders tokens in real-time with a formatted display

### Auth

On first run, the CLI auto-generates a UUID token stored in `~/.cfai/config.json`. This token serves as both authentication and the Durable Object key for session isolation.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- [Cloudflare account](https://dash.cloudflare.com/) (free tier works)

### Install & Run

```bash
# Install dependencies
pnpm install

# Start the worker locally
pnpm dev

# In another terminal — build and link the CLI
pnpm build:cli
cd cli && npm link

# Use it
cfai ask "hello, what can you do?"
cfai config set stack "TypeScript, Cloudflare Workers"
cfai ask "how do I set up a KV namespace?"
```

### Deploy to Cloudflare

```bash
pnpm deploy

# Point CLI to production
cfai config api-url https://cfai-worker.<your-subdomain>.workers.dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ask` | Send a message, get SSE streaming response |
| `POST` | `/api/config` | Set a profile key (`{ key, value }`) |
| `GET` | `/api/config` | Get full user profile |
| `GET` | `/api/history` | Get chat history (last 50 messages) |
| `DELETE` | `/api/clear` | Wipe all user data (history + profile) |
| `GET` | `/health` | Health check |

All endpoints (except `/health`) require `Authorization: Bearer <token>`.

## Tech Stack

- **Runtime**: Cloudflare Workers (edge, globally distributed)
- **LLM**: Llama 3.3 70B Instruct via Workers AI
- **State**: Durable Objects with SQLite (per-user persistent storage)
- **Language**: TypeScript (strict mode)
- **CLI Framework**: commander.js + custom TUI library
- **Build**: tsup (CLI), wrangler (Worker)
- **Monorepo**: pnpm workspaces with version catalog
