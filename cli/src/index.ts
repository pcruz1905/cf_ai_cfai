import { Command } from "commander";
import { readFileSync } from "node:fs";
import { loadConfig, updateConfig } from "./auth.js";
import {
  askStream,
  configSet,
  configGet,
  getHistory,
  clearSession,
} from "./client.js";
import {
  startSpinner,
  startStreamingResponse,
  success,
  fail,
  info,
  printHistory,
  printProfile,
  printWhoami,
  semantic,
} from "./ui.js";

const program = new Command();

program
  .name("cfai")
  .description("CLI AI assistant powered by Llama 3.3 on Cloudflare Workers AI")
  .version("0.1.0");

// ── ask ───────────────────────────────────────────────────────────────

program
  .command("ask")
  .description("Ask a question")
  .argument("<question...>", "Your question")
  .option("-f, --file <path>", "Attach a file for context")
  .action(async (questionParts: string[], opts: { file?: string }) => {
    const message = questionParts.join(" ");
    let fileContent: string | undefined;

    if (opts.file) {
      try {
        fileContent = readFileSync(opts.file, "utf-8");
        info(`Attached ${semantic.code(opts.file)}`);
      } catch {
        fail(`Could not read file: ${opts.file}`);
        process.exit(1);
      }
    }

    const spinner = startSpinner("Thinking...");
    let firstToken = true;
    let response: ReturnType<typeof startStreamingResponse> | undefined;

    try {
      await askStream({ message, fileContent }, (token) => {
        if (firstToken) {
          spinner.stop();
          response = startStreamingResponse();
          firstToken = false;
        }
        response?.write(token);
      });
      response?.end();
    } catch (err) {
      spinner.fail("Request failed");
      fail(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── fix ───────────────────────────────────────────────────────────────

program
  .command("fix")
  .description("Pipe output and get a fix suggestion")
  .action(async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const input = Buffer.concat(chunks).toString("utf-8").trim();

    if (!input) {
      fail("No input received. Pipe something into cfai fix.");
      info("Example: cat error.log | cfai fix");
      process.exit(1);
    }

    const message = `Fix this error or issue:\n\n\`\`\`\n${input}\n\`\`\``;
    const spinner = startSpinner("Analyzing...");
    let firstToken = true;
    let response: ReturnType<typeof startStreamingResponse> | undefined;

    try {
      await askStream({ message }, (token) => {
        if (firstToken) {
          spinner.stop();
          response = startStreamingResponse();
          firstToken = false;
        }
        response?.write(token);
      });
      response?.end();
    } catch (err) {
      spinner.fail("Request failed");
      fail(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── config ────────────────────────────────────────────────────────────

const configCmd = program
  .command("config")
  .description("Manage your profile configuration");

configCmd
  .command("set")
  .description("Set a profile key")
  .argument("<key>", "Profile key (e.g. stack, os, editor)")
  .argument("<value...>", "Profile value")
  .action(async (key: string, valueParts: string[]) => {
    const value = valueParts.join(" ");
    try {
      await configSet(key, value);
      success(`${key} ${semantic.muted("=")} ${value}`);
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

configCmd
  .command("get")
  .description("Show your profile")
  .action(async () => {
    try {
      const profile = await configGet();
      printProfile(profile);
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

configCmd
  .command("api-url")
  .description("Set the API URL")
  .argument("<url>", "Worker API URL")
  .action((url: string) => {
    updateConfig({ apiUrl: url });
    success(`API URL set to ${semantic.code(url)}`);
  });

// ── history ───────────────────────────────────────────────────────────

program
  .command("history")
  .description("Show chat history")
  .action(async () => {
    const spinner = startSpinner("Loading history...");
    try {
      const history = await getHistory();
      spinner.stop();
      printHistory(history);
    } catch (err) {
      spinner.fail("Failed to load history");
      fail(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── clear ─────────────────────────────────────────────────────────────

program
  .command("clear")
  .description("Clear all memory (history + profile)")
  .action(async () => {
    const spinner = startSpinner("Clearing session...");
    try {
      await clearSession();
      spinner.succeed("Session cleared — history and profile wiped");
    } catch (err) {
      spinner.fail("Failed to clear session");
      fail(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── whoami ────────────────────────────────────────────────────────────

program
  .command("whoami")
  .description("Show your token and API URL")
  .action(() => {
    const config = loadConfig();
    printWhoami(config.token, config.apiUrl);
  });

program.parse();
