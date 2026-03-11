import { describe, expect, it, vi } from "vitest";
import { MockAgent } from "../testConfig/mocks.js";

describe("CfaiAgent", () => {
    it("initializes tables and connects servers in init", async () => {
        const mock = new MockAgent();
        const agent = mock.asAgent();

        // Mock getServers to return some saved servers
        mock.servers = [{ id: "srv1", url: "http://srv1.com", name: "S1" }];

        // Track connect calls
        const connectSpy = vi.spyOn(mock.mcp, 'connect');

        await agent.init();

        expect(connectSpy).toHaveBeenCalledWith("http://srv1.com");
    });

    it("saves and loads history", () => {
        const mock = new MockAgent();
        const agent = mock.asAgent();

        agent.saveMessage("user", "hi");
        agent.saveMessage("assistant", "hello");

        const history = agent.loadHistory();
        expect(history).toHaveLength(2);
        expect(history[0]!.role).toBe("user");
        expect(history[1]!.role).toBe("assistant");
        expect(agent.getMessageCount()).toBe(2);
    });

    it("manages servers", () => {
        const mock = new MockAgent();
        const agent = mock.asAgent();

        agent.saveServer("id1", "url1", "name1");
        const servers = agent.getServers();
        expect(servers).toHaveLength(1);
        expect(servers[0]!.name).toBe("name1");

        agent.deleteServer("id1");
        expect(agent.getServers()).toHaveLength(0);
    });

    it("tracks requests and tool counts", () => {
        const mock = new MockAgent();
        const agent = mock.asAgent();

        agent.track("tool1");
        agent.track("tool1");
        agent.track("tool2");

        expect(agent.getTotalRequests()).toBe(3);
        expect(agent.getToolCounts()["tool1"]).toBe(2);
        expect(agent.getToolCounts()["tool2"]).toBe(1);
    });

    it("broadcasts to web sockets", () => {
        const mock = new MockAgent();
        const agent = mock.asAgent();

        const ws1 = { send: vi.fn() } as any;
        const ws2 = { send: vi.fn() } as any;
        mock.websockets = [ws1, ws2];

        agent.broadcast({ event: "test" });

        expect(ws1.send).toHaveBeenCalledWith(JSON.stringify({ event: "test" }));
        expect(ws2.send).toHaveBeenCalledWith(JSON.stringify({ event: "test" }));
    });

    it("handles rate limiting", () => {
        const mock = new MockAgent();
        const agent = mock.asAgent();

        // Fill up to limit
        for (let i = 0; i < 60; i++) {
            agent.track(`test-${i}`);
        }

        expect(() => agent.track("one-too-many")).toThrow(/Rate limit exceeded/);
    });
});
