import {
  ansi,
  semantic,
  symbols,
  spinnerFrames,
  renderBox,
  renderTable,
  type TableColumn,
} from "@sellhub/cli-tui";

// ── Simple spinner (no Effect dependency) ─────────────────────────────

interface SimpleSpinner {
  stop: () => void;
  succeed: (text?: string) => void;
  fail: (text?: string) => void;
}

export function startSpinner(text: string): SimpleSpinner {
  const frames = spinnerFrames.dots;
  const len = frames.length;
  let i = 0;
  const id = setInterval(() => {
    process.stderr.write(
      `\r${ansi.clearLine}  ${semantic.primary(frames[i++ % len]!)} ${text}`,
    );
  }, 80);

  return {
    stop() {
      clearInterval(id);
      process.stderr.write(`\r${ansi.clearLine}`);
    },
    succeed(msg?: string) {
      clearInterval(id);
      process.stderr.write(
        `\r${ansi.clearLine}  ${semantic.success(symbols.success)} ${msg ?? text}\n`,
      );
    },
    fail(msg?: string) {
      clearInterval(id);
      process.stderr.write(
        `\r${ansi.clearLine}  ${semantic.error(symbols.error)} ${msg ?? text}\n`,
      );
    },
  };
}

// ── Output helpers ────────────────────────────────────────────────────

export function info(msg: string): void {
  console.log(`  ${semantic.info(symbols.info)} ${msg}`);
}

export function success(msg: string): void {
  console.log(`  ${semantic.success(symbols.success)} ${msg}`);
}

export function warn(msg: string): void {
  console.log(`  ${semantic.warning(symbols.warning)} ${msg}`);
}

export function fail(msg: string): void {
  console.error(`  ${semantic.error(symbols.error)} ${msg}`);
}

export function header(title: string): void {
  console.log(`\n  ${semantic.header(title)}`);
}

export function muted(msg: string): void {
  console.log(`  ${semantic.muted(msg)}`);
}

// ── Box rendering ─────────────────────────────────────────────────────

export function printBox(
  content: string,
  title?: string,
): void {
  const lines = renderBox(content, {
    title,
    style: "rounded",
    padding: 1,
    margin: 1,
    borderColor: semantic.muted,
    titleColor: semantic.highlight,
  });
  for (const line of lines) {
    console.log(line);
  }
}

// ── History table ─────────────────────────────────────────────────────

interface HistoryEntry {
  role: string;
  content: string;
}

export function printHistory(messages: HistoryEntry[]): void {
  if (messages.length === 0) {
    muted("No history yet. Start a conversation with: cfai ask \"hello\"");
    return;
  }

  header(`Chat History (${messages.length} messages)`);
  console.log();

  for (const msg of messages) {
    const isUser = msg.role === "user";
    const icon = isUser ? symbols.arrowRight : symbols.arrowLeft;
    const label = isUser ? "You" : "AI";
    const labelColor = isUser ? semantic.highlight : semantic.primary;
    const contentPreview =
      msg.content.length > 200
        ? msg.content.slice(0, 200) + "..."
        : msg.content;

    console.log(`  ${labelColor(`${icon} ${label}`)}`);
    for (const line of contentPreview.split("\n")) {
      console.log(`    ${line}`);
    }
    console.log();
  }
}

// ── Profile table ─────────────────────────────────────────────────────

export function printProfile(profile: Record<string, string>): void {
  const entries = Object.entries(profile);
  if (entries.length === 0) {
    muted("No profile set yet.");
    info(`Set your stack: ${semantic.code("cfai config set stack \"TypeScript, Cloudflare Workers\"")}`);
    return;
  }

  const data = entries.map(([key, value]) => ({ key, value }));
  const columns: TableColumn<{ key: string; value: string }>[] = [
    { header: "Key", key: "key", align: "left" },
    { header: "Value", key: "value", align: "left" },
  ];

  header("Your Profile");
  console.log();

  const lines = renderTable({ columns, data, style: "rounded", indent: 2 });
  for (const line of lines) {
    console.log(line);
  }
}

// ── Whoami display ────────────────────────────────────────────────────

export function printWhoami(token: string, apiUrl: string): void {
  const lines = renderBox(
    [
      `${semantic.muted("Token:")}  ${token}`,
      `${semantic.muted("API:")}    ${apiUrl}`,
    ],
    {
      title: "cfai",
      style: "rounded",
      padding: 1,
      margin: 1,
      borderColor: semantic.muted,
      titleColor: semantic.highlight,
    },
  );
  for (const line of lines) {
    console.log(line);
  }
}

// ── Streaming response display ────────────────────────────────────────

export function startStreamingResponse(): {
  write: (token: string) => void;
  end: () => void;
} {
  // Print a left-border prefix for the AI response area
  console.log();
  process.stdout.write(`  ${semantic.muted(symbols.boxVertical)} `);

  let currentLineLength = 0;

  return {
    write(token: string) {
      // Handle newlines in tokens to maintain the left border
      const parts = token.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          process.stdout.write(`\n  ${semantic.muted(symbols.boxVertical)} `);
          currentLineLength = 0;
        }
        process.stdout.write(parts[i]!);
        currentLineLength += parts[i]!.length;
      }
    },
    end() {
      process.stdout.write("\n\n");
    },
  };
}

export { semantic, symbols, ansi } from "@sellhub/cli-tui";
