# PROMPTS.md

Prompts used to build this project with Claude Code, as required by the Cloudflare AI assignment.

## Build Prompts

### Prompt 1 — Concept

i want to make an mcp server that tools like copilot and claude code can use, this mcp can assign tasks in parallel so they dont burn expensive tokens, using cloudflare ai with ollama models. also i dont like having to connect 30 mcp servers every time so this one should let me plug in my other mcp servers and aggregate them all in one place, and i should be able to pick what model i want

### Prompt 2 — Project Setup

Scaffold the project as a pnpm workspace monorepo with:

- MIT license and a complete `README.md` with architecture diagram, tool table, and deploy instructions
- TypeScript configured with strict mode across the workspace via `tsconfig.base.json`
- Effect-TS (`effect`, `@effect/platform`, `@effect/vitest`) managed via the pnpm catalog
- Vitest with two test suites:
  - **Unit tests** (`*.unit.test.ts`) running in Node with `@effect/vitest` helpers and Istanbul coverage
  - **Workers integration tests** (`*.workers.test.ts`) running inside the real Cloudflare Workers
    runtime via `@cloudflare/vitest-pool-workers` (miniflare), testing routing, MCP protocol
    validation, and session lifecycle
- A `tsconfig.json` that includes test files and adds `@cloudflare/workers-types` plus
  `@cloudflare/vitest-pool-workers` so the IDE sees `Ai`, `cloudflare:test`, and `@testConfig` paths
  without errors

### Prompt 3 — CI Pipeline

Add a GitHub Actions CI workflow (`.github/workflows/ci.yml`) that runs on every push and pull request.
Tests and coverage only — no deployment. Steps:

1. Install dependencies with `pnpm install --frozen-lockfile`
2. Typecheck the whole workspace with `pnpm typecheck`
3. Run unit tests with Istanbul coverage (`pnpm test:coverage`) and upload the coverage report as a
   build artifact (7-day retention)
4. Run Workers integration tests in miniflare (`pnpm test:workers`)

Coverage for the Workers project is excluded because the CF Workers runtime does not support
instrumentation — only the unit project is measured.

### Prompt 4 — CI Fix

fix the CI — vitest with @cloudflare/vitest-pool-workers keeps failing with "Failed to start the remote proxy session" because the AI binding tries to connect remotely. make a wrangler.test.jsonc without the AI binding

### Prompt 5 — UX Improvements

make it easier to connect to mcp servers and add a help tool so new users know what's available. when adding a custom server show me what tools were discovered right away
