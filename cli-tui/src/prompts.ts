/**
 * Interactive prompts for user input.
 */

import { Effect } from "effect";
import * as readline from "node:readline";
import { ansi, semantic } from "./colors";
import { symbols } from "./symbols";

/**
 * Check if stdin is interactive (TTY).
 */
export function isInteractive(): boolean {
  return process.stdin.isTTY === true;
}

/**
 * Prompt for yes/no confirmation.
 */
export function confirm(
  message: string,
  options?: { defaultValue?: boolean },
): Effect.Effect<boolean> {
  if (!isInteractive()) {
    return Effect.succeed(options?.defaultValue ?? false);
  }

  return Effect.async<boolean>((resume) => {
    const defaultValue = options?.defaultValue ?? true;
    const hint = defaultValue ? "[Y/n]" : "[y/N]";

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    process.stderr.write(
      `  ${semantic.primary(symbols.question)} ${message} ${semantic.muted(hint)} `,
    );

    rl.once("line", (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();

      if (trimmed === "") {
        resume(Effect.succeed(defaultValue));
      } else if (trimmed === "y" || trimmed === "yes") {
        resume(Effect.succeed(true));
      } else {
        resume(Effect.succeed(false));
      }
    });

    rl.once("close", () => {
      resume(Effect.succeed(defaultValue));
    });
  });
}

/**
 * Prompt for text input.
 */
export function input(
  message: string,
  options?: {
    defaultValue?: string;
    placeholder?: string;
    validate?: (value: string) => string | null;
  },
): Effect.Effect<string> {
  if (!isInteractive()) {
    return Effect.succeed(options?.defaultValue ?? "");
  }

  return Effect.async<string>((resume) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    const hint = options?.placeholder
      ? ` ${semantic.muted(`(${options.placeholder})`)}`
      : options?.defaultValue
        ? ` ${semantic.muted(`[${options.defaultValue}]`)}`
        : "";

    process.stderr.write(
      `  ${semantic.primary(symbols.pointer)} ${message}${hint}: `,
    );

    rl.once("line", (answer) => {
      rl.close();
      const value = answer.trim() || options?.defaultValue || "";

      if (options?.validate) {
        const error = options.validate(value);
        if (error) {
          process.stderr.write(`  ${semantic.error(symbols.error)} ${error}\n`);
          resume(input(message, options));
          return;
        }
      }

      resume(Effect.succeed(value));
    });

    rl.once("close", () => {
      resume(Effect.succeed(options?.defaultValue ?? ""));
    });
  });
}

/**
 * Prompt for password input (hidden).
 */
export function password(
  message: string,
  options?: {
    mask?: string;
    validate?: (value: string) => string | null;
  },
): Effect.Effect<string> {
  if (!isInteractive()) {
    return Effect.succeed("");
  }

  return Effect.async<string>((resume) => {
    const mask = options?.mask ?? "*";
    let value = "";

    process.stderr.write(
      `  ${semantic.primary(symbols.lock)} ${message}: `,
    );

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (char: string) => {
      const charCode = char.charCodeAt(0);

      if (charCode === 13 || charCode === 10) {
        // Enter
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stderr.write("\n");

        if (options?.validate) {
          const error = options.validate(value);
          if (error) {
            process.stderr.write(`  ${semantic.error(symbols.error)} ${error}\n`);
            value = "";
            resume(password(message, options));
            return;
          }
        }

        resume(Effect.succeed(value));
      } else if (charCode === 3) {
        // Ctrl+C
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stderr.write("\n");
        process.exit(130);
      } else if (charCode === 127) {
        // Backspace
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stderr.write("\b \b");
        }
      } else {
        value += char;
        process.stderr.write(mask);
      }
    };

    process.stdin.on("data", onData);
  });
}

export interface SelectOption<T> {
  readonly label: string;
  readonly value: T;
  readonly hint?: string;
}

/**
 * Prompt for single selection from options.
 */
export function select<T>(
  message: string,
  options: readonly SelectOption<T>[],
  config?: {
    defaultIndex?: number;
  },
): Effect.Effect<T> {
  if (!isInteractive()) {
    const defaultIdx = config?.defaultIndex ?? 0;
    return Effect.succeed(options[defaultIdx]!.value);
  }

  return Effect.async<T>((resume) => {
    let selectedIndex = config?.defaultIndex ?? 0;

    const render = () => {
      // Move cursor up to clear previous render
      if (selectedIndex >= 0) {
        process.stderr.write(ansi.cursorUp(options.length));
      }

      for (let i = 0; i < options.length; i++) {
        const opt = options[i]!;
        const isSelected = i === selectedIndex;
        const pointer = isSelected
          ? semantic.primary(symbols.pointer)
          : " ";
        const label = isSelected
          ? semantic.primary(opt.label)
          : opt.label;
        const hint = opt.hint ? ` ${semantic.muted(opt.hint)}` : "";

        process.stderr.write(`${ansi.clearLine}  ${pointer} ${label}${hint}\n`);
      }
    };

    process.stderr.write(`  ${semantic.info(symbols.question)} ${message}\n`);

    // Initial render
    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!;
      const isSelected = i === selectedIndex;
      const pointer = isSelected ? semantic.primary(symbols.pointer) : " ";
      const label = isSelected ? semantic.primary(opt.label) : opt.label;
      const hint = opt.hint ? ` ${semantic.muted(opt.hint)}` : "";
      process.stderr.write(`  ${pointer} ${label}${hint}\n`);
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (key: string) => {
      const code = key.charCodeAt(0);

      // Arrow keys send escape sequences
      if (key === "\u001B[A") {
        // Up arrow
        selectedIndex = Math.max(0, selectedIndex - 1);
        render();
      } else if (key === "\u001B[B") {
        // Down arrow
        selectedIndex = Math.min(options.length - 1, selectedIndex + 1);
        render();
      } else if (code === 13 || code === 10) {
        // Enter
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        resume(Effect.succeed(options[selectedIndex]!.value));
      } else if (code === 3) {
        // Ctrl+C
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stderr.write("\n");
        process.exit(130);
      } else if (code === 27) {
        // Escape - read the rest of the sequence
        // Arrow keys are \x1b[A, \x1b[B, etc.
      }
    };

    process.stdin.on("data", onData);
  });
}

/**
 * Prompt for multiple selection from options.
 */
export function multiSelect<T>(
  message: string,
  options: readonly SelectOption<T>[],
  config?: {
    defaultSelected?: readonly number[];
    required?: boolean;
    min?: number;
    max?: number;
  },
): Effect.Effect<T[]> {
  if (!isInteractive()) {
    const defaultSelected = config?.defaultSelected ?? [];
    return Effect.succeed(
      defaultSelected.map((i) => options[i]!.value),
    );
  }

  return Effect.async<T[]>((resume) => {
    let cursorIndex = 0;
    const selected = new Set<number>(config?.defaultSelected ?? []);

    const render = () => {
      process.stderr.write(ansi.cursorUp(options.length));

      for (let i = 0; i < options.length; i++) {
        const opt = options[i]!;
        const isAtCursor = i === cursorIndex;
        const isSelected = selected.has(i);
        const checkbox = isSelected
          ? semantic.success(symbols.checkboxOn)
          : semantic.muted(symbols.checkboxOff);
        const label = isAtCursor ? semantic.primary(opt.label) : opt.label;
        const hint = opt.hint ? ` ${semantic.muted(opt.hint)}` : "";

        process.stderr.write(`${ansi.clearLine}  ${checkbox} ${label}${hint}\n`);
      }
    };

    process.stderr.write(
      `  ${semantic.info(symbols.question)} ${message} ${semantic.muted("(space to toggle, enter to confirm)")}\n`,
    );

    // Initial render
    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!;
      const isAtCursor = i === cursorIndex;
      const isSelected = selected.has(i);
      const checkbox = isSelected
        ? semantic.success(symbols.checkboxOn)
        : semantic.muted(symbols.checkboxOff);
      const label = isAtCursor ? semantic.primary(opt.label) : opt.label;
      const hint = opt.hint ? ` ${semantic.muted(opt.hint)}` : "";
      process.stderr.write(`  ${checkbox} ${label}${hint}\n`);
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (key: string) => {
      const code = key.charCodeAt(0);

      if (key === "\u001B[A") {
        // Up
        cursorIndex = Math.max(0, cursorIndex - 1);
        render();
      } else if (key === "\u001B[B") {
        // Down
        cursorIndex = Math.min(options.length - 1, cursorIndex + 1);
        render();
      } else if (code === 32) {
        // Space - toggle
        if (selected.has(cursorIndex)) {
          selected.delete(cursorIndex);
        } else {
          if (!config?.max || selected.size < config.max) {
            selected.add(cursorIndex);
          }
        }
        render();
      } else if (code === 13 || code === 10) {
        // Enter
        if (config?.required && selected.size === 0) {
          return; // Don't allow empty selection if required
        }
        if (config?.min && selected.size < config.min) {
          return; // Don't allow if below minimum
        }

        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);

        const result = Array.from(selected)
          .sort((a, b) => a - b)
          .map((i) => options[i]!.value);
        resume(Effect.succeed(result));
      } else if (code === 3) {
        // Ctrl+C
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stderr.write("\n");
        process.exit(130);
      }
    };

    process.stdin.on("data", onData);
  });
}

/**
 * Simple non-interactive fallback for confirmation.
 */
export function nonInteractiveConfirm(
  message: string,
  defaultValue: boolean,
): Effect.Effect<boolean> {
  return Effect.sync(() => {
    const value = defaultValue ? "yes" : "no";
    console.log(`  ${symbols.info} ${message}: ${value} (non-interactive)`);
    return defaultValue;
  });
}

/**
 * Auto-detect and use appropriate confirm function.
 */
export function autoConfirm(
  message: string,
  options?: { defaultValue?: boolean },
): Effect.Effect<boolean> {
  if (isInteractive()) {
    return confirm(message, options);
  }
  return nonInteractiveConfirm(message, options?.defaultValue ?? false);
}
