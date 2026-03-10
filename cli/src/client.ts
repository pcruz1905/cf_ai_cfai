import { loadConfig } from "./auth.js";

interface AskPayload {
  message: string;
  fileContent?: string;
}

function headers(): Record<string, string> {
  const config = loadConfig();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.token}`,
  };
}

function apiUrl(path: string): string {
  const config = loadConfig();
  return `${config.apiUrl}${path}`;
}

async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(
        response.status === 401
          ? "Unauthorized — check your token with: cfai whoami"
          : `API error (${response.status}): ${text}`,
      );
    }
    return response;
  } catch (err) {
    if (err instanceof TypeError && (err as NodeJS.ErrnoException).cause) {
      throw new Error(
        `Cannot connect to API at ${url} — is the worker running?\n  Start it with: pnpm dev`,
      );
    }
    throw err;
  }
}

export async function askStream(
  payload: AskPayload,
  onToken: (token: string) => void,
): Promise<void> {
  const response = await safeFetch(apiUrl("/api/ask"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as { response?: string };
        if (parsed.response) onToken(parsed.response);
      } catch {
        // skip malformed SSE chunks
      }
    }
  }
}

export async function configSet(key: string, value: string): Promise<void> {
  await safeFetch(apiUrl("/api/config"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ key, value }),
  });
}

export async function configGet(): Promise<Record<string, string>> {
  const response = await safeFetch(apiUrl("/api/config"), {
    method: "GET",
    headers: headers(),
  });
  return (await response.json()) as Record<string, string>;
}

export async function getHistory(): Promise<
  Array<{ role: string; content: string }>
> {
  const response = await safeFetch(apiUrl("/api/history"), {
    method: "GET",
    headers: headers(),
  });
  return (await response.json()) as Array<{ role: string; content: string }>;
}

export async function clearSession(): Promise<void> {
  await safeFetch(apiUrl("/api/clear"), {
    method: "DELETE",
    headers: headers(),
  });
}
