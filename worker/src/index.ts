import { UserSession } from "./session";
import { buildSystemPrompt, buildMessages } from "./prompts";

export { UserSession };

interface Env {
  AI: Ai;
  USER_SESSION: DurableObjectNamespace<UserSession>;
}

function getSession(env: Env, token: string): DurableObjectStub<UserSession> {
  const id = env.USER_SESSION.idFromName(token);
  return env.USER_SESSION.get(id);
}

function unauthorized(): Response {
  return Response.json({ error: "Missing Authorization header" }, { status: 401 });
}

function extractToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const token = extractToken(request);
    if (!token) return unauthorized();

    const session = getSession(env, token);

    if (url.pathname === "/api/ask" && request.method === "POST") {
      return handleAsk(request, env, session);
    }

    if (url.pathname === "/api/config" && request.method === "POST") {
      return handleConfigSet(request, session);
    }

    if (url.pathname === "/api/config" && request.method === "GET") {
      return handleConfigGet(session);
    }

    if (url.pathname === "/api/history" && request.method === "GET") {
      return handleHistory(session);
    }

    if (url.pathname === "/api/clear" && request.method === "DELETE") {
      return handleClear(session);
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleAsk(
  request: Request,
  env: Env,
  session: DurableObjectStub<UserSession>,
): Promise<Response> {
  const body = (await request.json()) as {
    message: string;
    fileContent?: string;
  };

  const [profile, history] = await Promise.all([
    session.getProfile(),
    session.getHistory(),
  ]);

  const systemPrompt = buildSystemPrompt(profile);
  const messages = buildMessages(
    systemPrompt,
    history,
    body.message,
    body.fileContent,
  );

  await session.addMessage({ role: "user", content: body.message });

  const stream = await env.AI.run(
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    { messages, stream: true },
  );

  // Collect full response for storage while streaming to client
  const [storageStream, clientStream] = (stream as ReadableStream).tee();

  // Store the complete response asynchronously
  void (async () => {
    const reader = storageStream.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as { response?: string };
          if (parsed.response) fullResponse += parsed.response;
        } catch {
          // skip malformed chunks
        }
      }
    }
    if (fullResponse) {
      await session.addMessage({ role: "assistant", content: fullResponse });
    }
  })();

  return new Response(clientStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function handleConfigSet(
  request: Request,
  session: DurableObjectStub<UserSession>,
): Promise<Response> {
  const body = (await request.json()) as { key: string; value: string };
  await session.setProfileKey(body.key, body.value);
  return Response.json({ ok: true, key: body.key, value: body.value });
}

async function handleConfigGet(
  session: DurableObjectStub<UserSession>,
): Promise<Response> {
  const profile = await session.getProfile();
  return Response.json(profile);
}

async function handleHistory(
  session: DurableObjectStub<UserSession>,
): Promise<Response> {
  const history = await session.getHistory(50);
  return Response.json(history);
}

async function handleClear(
  session: DurableObjectStub<UserSession>,
): Promise<Response> {
  await session.clearAll();
  return Response.json({ ok: true });
}
