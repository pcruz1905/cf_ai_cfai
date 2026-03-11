import { type Message } from "../src/ai.js";
import type { CfaiAgent, MessageRole, DbServer } from "../src/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export class MockAgent {
    tools = new Map<string, { schema: any; handler: (args: any) => Promise<any> }>();

    state = { selectedModel: "default-model" };
    history: Message[] = [];
    toolCounts: Record<string, number> = {};
    totalRequests = 0;
    servers: DbServer[] = [];
    tracked: string[] = [];
    broadcasted: any[] = [];
    websockets: any[] = [];
    callTimestamps: number[] = [];

    aiResponse: string | (() => string) = "mock ai response";

    // mock context/env
    ctx = {
        getWebSockets: () => this.websockets,
        waitUntil: (p: Promise<any>) => p,
        acceptWebSocket: () => {
            const ws = {} as any; // Simple mock WS
            this.websockets.push(ws);
            return ws;
        }
    };

    env = {
        AI: { run: () => this.ai.run() } as any,
        CFAI_AGENT: {
            idFromName: (name: string) => ({ toString: () => `id-${name}` }),
            get: (id: any) => ({ fetch: (req: any) => new Response("ok") }),
        } as any
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
        registerTool: (name: string, opts: any, handler: any) => {
            this.tools.set(name, { schema: opts.inputSchema, handler });
        }
    };

    ai = {
        run: async () => ({ response: typeof this.aiResponse === 'function' ? this.aiResponse() : this.aiResponse }),
        aiManager: null as any
    };

    sql<T>(strings: TemplateStringsArray, ...values: any[]): T[] {
        const query = strings.join("?");
        if (query.includes("COUNT(*)")) return [{ count: this.history.length }] as any;
        if (query.includes("mcp_servers")) {
            if (query.includes("DELETE")) {
                const id = values[0];
                this.servers = this.servers.filter(s => s.id !== id);
                return [] as any;
            }
            if (query.includes("INSERT")) {
                const [id, url, name] = values;
                this.saveServer(id, url, name);
                return [] as any;
            }
            return this.servers as any;
        }
        if (query.includes("INSERT INTO messages")) {
            const [role, content] = values;
            this.saveMessage(role, content);
            return [] as any;
        }
        if (query.includes("SELECT role, content FROM messages")) {
            return this.history.map(m => ({ role: m.role, content: m.content })) as any;
        }
        return [] as any;
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

    asAgent() {
        return this as any as CfaiAgent;
    }

    async callHandler(name: string, args: any = {}) {
        const tool = this.tools.get(name);
        if (!tool) throw new Error(`Tool not registered: ${name}`);
        return tool.handler(args);
    }
}
