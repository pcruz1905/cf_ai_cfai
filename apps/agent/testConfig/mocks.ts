import { vi } from "vitest";
import { type Message } from "../src/ai.js";
import type { CfaiAgent, MessageRole, DbServer } from "../src/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

interface ToolHandlerResult {
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
}

type ToolHandler = (args: Record<string, unknown>) => Promise<ToolHandlerResult>;

export class MockAgent {
    tools = new Map<string, { schema: Tool["inputSchema"]; handler: ToolHandler }>();

    state = { selectedModel: "default-model" };
    history: Message[] = [];
    toolCounts: Record<string, number> = {};
    totalRequests = 0;
    servers: DbServer[] = [];
    tracked: string[] = [];
    broadcasted: Record<string, unknown>[] = [];
    websockets: { send: (msg: string) => void; close: (code: number, reason: string) => void }[] = [];
    callTimestamps: number[] = [];

    aiResponse: string | (() => string) = "mock ai response";

    // mock context/env
    ctx = {
        getWebSockets: () => this.websockets as unknown as WebSocket[],
        waitUntil: (p: Promise<unknown>) => p,
        acceptWebSocket: () => {
            const ws = {
                send: vi.fn(),
                close: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            } as unknown as WebSocket;
            this.websockets.push(ws as any);
            return ws;
        }
    };

    env = {
        AI: { run: () => this.ai.run() } as unknown as Ai,
        CFAI_AGENT: {
            idFromName: (name: string) => ({ toString: () => `id-${name}` }),
            get: (_id: unknown) => ({ fetch: (_req: Request) => new Response("ok") }),
        } as unknown as DurableObjectNamespace
    };

    // mock mcp connections
    mcp = {
        mcpConnections: {} as Record<string, { tools: any[]; connectionState?: string }>,
        listTools: () => {
            const all: (Tool & { serverId?: string })[] = [];
            for (const [id, conn] of Object.entries(this.mcp.mcpConnections)) {
                for (const t of conn.tools) {
                    all.push({ ...t, serverId: id });
                }
            }
            return all;
        },
        callTool: async () => ({ content: [{ type: "text", text: "mock upstream result" }] }),
        connect: async (url: string) => {
            const id = `mock-id-${url}`;
            if (!this.mcp.mcpConnections[id]) {
                this.mcp.mcpConnections[id] = { tools: [], connectionState: "connected" };
            }
            return { id, authUrl: undefined };
        },
        closeConnection: async (id: string) => { delete this.mcp.mcpConnections[id]; },
    };

    server = {
        registerTool: (name: string, opts: { inputSchema: Tool["inputSchema"] }, handler: ToolHandler) => {
            this.tools.set(name, { schema: opts.inputSchema, handler });
        }
    };

    ai = {
        run: async () => ({ response: typeof this.aiResponse === 'function' ? this.aiResponse() : this.aiResponse }),
        aiManager: null as unknown as any
    };

    sql<T>(strings: TemplateStringsArray, ...values: unknown[]): T[] {
        const query = strings.join("?");
        if (query.includes("COUNT(*)")) return [{ count: this.history.length }] as unknown as T[];
        if (query.includes("mcp_servers")) {
            if (query.includes("DELETE")) {
                const id = values[0] as string;
                this.servers = this.servers.filter(s => s.id !== id);
                return [] as unknown as T[];
            }
            if (query.includes("INSERT")) {
                const [id, url, name] = values as [string, string, string];
                this.saveServer(id, url, name);
                return [] as unknown as T[];
            }
            return this.servers as unknown as T[];
        }
        if (query.includes("INSERT INTO messages")) {
            const [role, content] = values as [MessageRole, string];
            this.saveMessage(role, content);
            return [] as unknown as T[];
        }
        if (query.includes("SELECT role, content FROM messages")) {
            return this.history.map(m => ({ role: m.role, content: m.content })) as unknown as T[];
        }
        return [] as unknown as T[];
    }

    model() { return this.state.selectedModel; }
    setState(s: any) { this.state = s; }

    loadHistory() { return [...this.history]; }
    saveMessage(role: MessageRole, content: string) {
        this.history.push({ role: role as any, content });
    }

    getServers() { return [...this.servers]; }
    saveServer(id: string, url: string, name: string) {
        const existing = this.servers.findIndex(s => s.id === id);
        if (existing >= 0) this.servers[existing] = { id, url, name };
        else this.servers.push({ id, url, name });
    }
    deleteServer(id: string) {
        this.servers = this.servers.filter(s => s.id !== id);
    }

    getToolCounts() { return this.toolCounts; }
    getTotalRequests() { return this.totalRequests; }
    getMessageCount() { return this.history.length; }

    broadcast(data: Record<string, unknown>) {
        this.broadcasted.push(data);
        const msg = JSON.stringify(data);
        for (const ws of this.ctx.getWebSockets()) {
            try { ws.send(msg); } catch { /* client gone */ }
        }
    }

    track(tool: string) {
        const now = Date.now();
        this.callTimestamps = this.callTimestamps.filter((t) => now - t < 60_000);
        if (this.callTimestamps.length >= 60) {
            throw new Error(`Rate limit exceeded: max 60 tool calls per minute. Try again shortly.`);
        }
        this.callTimestamps.push(now);

        this.tracked.push(tool);
        this.totalRequests++;
        this.toolCounts[tool] = (this.toolCounts[tool] ?? 0) + 1;
    }

    async init() {
        // Mock init behavior
        const saved = this.getServers();
        for (const srv of saved) {
            await this.mcp.connect(srv.url);
        }
    }

    asAgent(): CfaiAgent {
        return this as unknown as CfaiAgent;
    }

    async callHandler(name: string, args: Record<string, unknown> = {}) {
        const tool = this.tools.get(name);
        if (!tool) throw new Error(`Tool not registered: ${name}`);
        return tool.handler(args);
    }
}
