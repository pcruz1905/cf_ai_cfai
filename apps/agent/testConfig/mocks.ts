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

    aiResponse: string | (() => string) = "mock ai response";

    // mock mcp connections
    mcp = {
        mcpConnections: {} as Record<string, any>,
        listTools: () => [] as (Tool & { serverId?: string })[],
        callTool: async () => ({ content: [{ type: "text", text: "mock upstream result" }] }),
        connect: async (url: string) => ({ id: "mock-id", authUrl: undefined }),
        closeConnection: async (id: string) => { },
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

    model() { return this.state.selectedModel; }
    setState(s: any) { this.state = s; }

    loadHistory() { return [...this.history]; }
    saveMessage(role: MessageRole, content: string) {
        this.history.push({ role, content });
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

    track(tool: string) {
        this.tracked.push(tool);
        this.totalRequests++;
        this.toolCounts[tool] = (this.toolCounts[tool] ?? 0) + 1;
    }

    broadcast(data: any) {
        this.broadcasted.push(data);
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
