import { z } from "zod";
import { Effect } from "effect";
import { runInference, type Message } from "../ai.js";
import { PROMPTS } from "../prompts.js";
import type { CfaiAgent } from "../index.js";
import { textContent, runTool } from "../utils.js";

const askLlm = Effect.fn("ask_llm")(function* (
  ai: Ai,
  messages: Message[],
  question: string,
) {
  yield* Effect.annotateCurrentSpan("question", question);
  return yield* runInference(ai, messages);
});

const explainError = Effect.fn("explain_error")(function* (
  ai: Ai,
  messages: Message[],
  hasContext: boolean,
) {
  yield* Effect.annotateCurrentSpan("has_context", hasContext);
  return yield* runInference(ai, messages);
});

const summarize = Effect.fn("summarize")(function* (
  ai: Ai,
  messages: Message[],
  format: "bullets" | "paragraph" | "tldr",
) {
  yield* Effect.annotateCurrentSpan("format", format);
  return yield* runInference(ai, messages);
});

const generateCommit = Effect.fn("generate_commit")(function* (
  ai: Ai,
  messages: Message[],
) {
  return yield* runInference(ai, messages);
});

const translate = Effect.fn("translate")(function* (
  ai: Ai,
  messages: Message[],
  target: string,
  source: string | undefined,
) {
  yield* Effect.annotateCurrentSpan("target", target);
  yield* Effect.annotateCurrentSpan("source", source ?? "auto");
  return yield* runInference(ai, messages);
});

const reviewCode = Effect.fn("review_code")(function* (
  ai: Ai,
  messages: Message[],
  language: string | undefined,
  focus: string,
) {
  yield* Effect.annotateCurrentSpan("language", language ?? "auto");
  yield* Effect.annotateCurrentSpan("focus", focus);
  return yield* runInference(ai, messages);
});

export function registerAiTools(agent: CfaiAgent) {
  agent.server.registerTool(
    "ask_llm",
    {
      description:
        "Ask the LLM anything. Remembers the last 20 messages per session — supports follow-up questions, brainstorming, and explanations.",
      inputSchema: {
        question: z.string().describe("The question or prompt to answer"),
      },
    },
    async ({ question }) => {
      const history = agent.loadHistory();
      agent.saveMessage("user", question);
      const messages: Message[] = [
        { role: "system", content: PROMPTS.ask },
        ...history,
        { role: "user", content: question },
      ];
      agent.track("ask_llm");
      const text = await runTool(askLlm(agent.ai, messages, question));
      agent.saveMessage("assistant", text);
      return textContent(text);
    },
  );

  agent.server.registerTool(
    "explain_error",
    {
      description:
        "Paste an error message or stack trace and get a plain-English explanation with suggested fixes.",
      inputSchema: {
        error: z.string().describe("The error message or stack trace"),
        context: z
          .string()
          .optional()
          .describe("Optional surrounding code or context"),
      },
    },
    async ({ error, context }) => {
      const user = context
        ? `Error:\n${error}\n\nContext:\n${context}`
        : error;
      const messages: Message[] = [
        { role: "system", content: PROMPTS.explainError },
        { role: "user", content: user },
      ];
      agent.track("explain_error");
      return textContent(await runTool(explainError(agent.ai, messages, !!context)));
    },
  );

  agent.server.registerTool(
    "summarize",
    {
      description:
        "Summarize text, code, or documentation into a concise digest.",
      inputSchema: {
        content: z.string().describe("The text or code to summarize"),
        format: z
          .enum(["bullets", "paragraph", "tldr"])
          .optional()
          .default("bullets")
          .describe("Output format"),
      },
    },
    async ({ content, format }) => {
      const fmt = format ?? "bullets";
      const messages: Message[] = [
        { role: "system", content: PROMPTS.summarize(fmt) },
        { role: "user", content },
      ];
      agent.track("summarize");
      return textContent(await runTool(summarize(agent.ai, messages, fmt)));
    },
  );

  agent.server.registerTool(
    "generate_commit",
    {
      description:
        "Generate a conventional commit message from a git diff or description of changes.",
      inputSchema: {
        diff: z
          .string()
          .describe("The git diff or description of what changed"),
      },
    },
    async ({ diff }) => {
      const messages: Message[] = [
        { role: "system", content: PROMPTS.generateCommit },
        { role: "user", content: diff },
      ];
      agent.track("generate_commit");
      return textContent(await runTool(generateCommit(agent.ai, messages)));
    },
  );

  agent.server.registerTool(
    "translate",
    {
      description: "Translate text from one language to another.",
      inputSchema: {
        text: z.string().describe("Text to translate"),
        target: z
          .string()
          .describe("Target language (e.g. 'Spanish', 'French', 'Japanese')"),
        source: z
          .string()
          .optional()
          .describe("Source language — auto-detected if omitted"),
      },
    },
    async ({ text, target, source }) => {
      const user = source
        ? `Translate from ${source} to ${target}:\n\n${text}`
        : `Translate to ${target}:\n\n${text}`;
      const messages: Message[] = [
        { role: "system", content: PROMPTS.translate },
        { role: "user", content: user },
      ];
      agent.track("translate");
      return textContent(await runTool(translate(agent.ai, messages, target, source)));
    },
  );

  agent.server.registerTool(
    "review_code",
    {
      description:
        "Quick code review: spots bugs, security issues, performance problems, and style improvements.",
      inputSchema: {
        code: z.string().describe("The code to review"),
        language: z
          .string()
          .optional()
          .describe("Programming language — auto-detected if omitted"),
        focus: z
          .enum(["bugs", "security", "performance", "style", "all"])
          .optional()
          .default("all")
          .describe("What to focus on"),
      },
    },
    async ({ code, language, focus }) => {
      const f = focus ?? "all";
      const lang = language ? ` (${language})` : "";
      const user = `Focus: ${f}\n\nCode${lang}:\n\`\`\`\n${code}\n\`\`\``;
      const messages: Message[] = [
        { role: "system", content: PROMPTS.reviewCode },
        { role: "user", content: user },
      ];
      agent.track("review_code");
      return textContent(await runTool(reviewCode(agent.ai, messages, language, f)));
    },
  );
}
