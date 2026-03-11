import { Effect } from "effect";
import { McpGatewayError } from "./errors.js";

/** MCP text content shorthand — eliminates repeated `{ type: "text" as const }`. */
export const textContent = (text: string) => ({
    content: [{ type: "text" as const, text }],
});

/** Run an Effect and fall back to an error string — safe at the MCP boundary. */
export function runTool<E extends { message: string }>(
    effect: Effect.Effect<string, E>,
): Promise<string> {
    return Effect.runPromise(
        effect.pipe(
            Effect.catchAll((e) =>
                Effect.succeed(`I encountered an error: ${e.message}`),
            ),
        ),
    );
}

/** Connect to an upstream MCP server — Effect-based with typed errors. */
export const connectServer = Effect.fn("CfaiAgent.connectServer")(function* (
    mcp: { connect: (url: string, opts?: object) => Promise<{ id: string; authUrl: string | undefined }> },
    url: string,
) {
    const result = yield* Effect.tryPromise({
        try: () => mcp.connect(url),
        catch: (e) =>
            new McpGatewayError({ message: `Failed to connect to ${url}: ${String(e)}` }),
    });
    return result;
});
