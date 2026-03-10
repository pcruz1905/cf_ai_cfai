import type { UserProfile, ChatMessage } from "./session";

export function buildSystemPrompt(profile: UserProfile): string {
  const lines = [
    "You are cfai, a helpful CLI assistant for developers.",
    "You give concise, practical answers focused on solving problems.",
    "When showing code, use the language most relevant to the user's question.",
    "Keep responses short unless the user asks for detail.",
  ];

  const entries = Object.entries(profile).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (entries.length > 0) {
    lines.push("", "User profile:");
    for (const [key, value] of entries) {
      lines.push(`- ${key}: ${value}`);
    }
  }

  return lines.join("\n");
}

export function buildMessages(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  fileContent?: string,
): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  const recent = history.slice(-20);
  messages.push(...recent);

  let content = userMessage;
  if (fileContent) {
    content += `\n\n---\nAttached file content:\n\`\`\`\n${fileContent}\n\`\`\``;
  }

  messages.push({ role: "user", content });
  return messages;
}
