import { z } from "zod";
import { Effect } from "effect";
import { runInference, type Message } from "../ai.js";
import { PROMPTS } from "../prompts.js";
import type { CfaiAgent } from "../index.js";
import { textContent, runTool } from "../utils.js";

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
            const askAndSave = Effect.fn("ask_llm")(function* () {
                yield* Effect.annotateCurrentSpan("question", question);
                const history = agent.loadHistory();
                agent.saveMessage("user", question);

                const messages: Message[] = [
                    { role: "system", content: PROMPTS.ask },
                    ...history,
                    { role: "user", content: question },
                ];
                const text = yield* runInference(agent.ai, messages, agent.model());
                agent.saveMessage("assistant", text);
                return text;
            });

            agent.track("ask_llm");
            const text = await runTool(askAndSave());
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
            const explain = Effect.fn("explain_error")(function* () {
                yield* Effect.annotateCurrentSpan("has_context", !!context);
                const user = context
                    ? `Error:\n${error}\n\nContext:\n${context}`
                    : error;
                const messages: Message[] = [
                    { role: "system", content: PROMPTS.explainError },
                    { role: "user", content: user },
                ];
                return yield* runInference(agent.ai, messages, agent.model());
            });

            agent.track("explain_error");
            const text = await runTool(explain());
            return textContent(text);
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
            const runSummary = Effect.fn("summarize")(function* () {
                yield* Effect.annotateCurrentSpan("format", format ?? "bullets");
                const messages: Message[] = [
                    { role: "system", content: PROMPTS.summarize(format ?? "bullets") },
                    { role: "user", content },
                ];
                return yield* runInference(agent.ai, messages, agent.model());
            });

            agent.track("summarize");
            const text = await runTool(runSummary());
            return textContent(text);
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
            const commit = Effect.fn("generate_commit")(function* () {
                const messages: Message[] = [
                    { role: "system", content: PROMPTS.generateCommit },
                    { role: "user", content: diff },
                ];
                return yield* runInference(agent.ai, messages, agent.model());
            });

            agent.track("generate_commit");
            const text = await runTool(commit());
            return textContent(text);
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
                    .describe(
                        "Target language (e.g. 'Spanish', 'French', 'Japanese')",
                    ),
                source: z
                    .string()
                    .optional()
                    .describe("Source language — auto-detected if omitted"),
            },
        },
        async ({ text, target, source }) => {
            const runTranslation = Effect.fn("translate")(function* () {
                yield* Effect.annotateCurrentSpan("target", target);
                yield* Effect.annotateCurrentSpan("source", source ?? "auto");
                const user = source
                    ? `Translate from ${source} to ${target}:\n\n${text}`
                    : `Translate to ${target}:\n\n${text}`;
                const messages: Message[] = [
                    { role: "system", content: PROMPTS.translate },
                    { role: "user", content: user },
                ];
                return yield* runInference(agent.ai, messages, agent.model());
            });

            agent.track("translate");
            const result = await runTool(runTranslation());
            return textContent(result);
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
            const review = Effect.fn("review_code")(function* () {
                yield* Effect.annotateCurrentSpan("language", language ?? "auto");
                yield* Effect.annotateCurrentSpan("focus", focus ?? "all");
                const lang = language ? ` (${language})` : "";
                const user = `Focus: ${focus ?? "all"}\n\nCode${lang}:\n\`\`\`\n${code}\n\`\`\``;
                const messages: Message[] = [
                    { role: "system", content: PROMPTS.reviewCode },
                    { role: "user", content: user },
                ];
                return yield* runInference(agent.ai, messages, agent.model());
            });

            agent.track("review_code");
            const text = await runTool(review());
            return textContent(text);
        },
    );
}
