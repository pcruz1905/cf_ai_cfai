/**
 * Animated spinner for long-running operations.
 */

import { Effect, Fiber, Ref, Schedule } from "effect";
import { ansi, semantic } from "./colors";
import { spinnerFrames, symbols, type SpinnerType } from "./symbols";

export interface SpinnerConfig {
  readonly type?: SpinnerType;
  readonly text?: string;
  readonly interval?: number;
  readonly stream?: NodeJS.WriteStream;
  readonly indent?: number;
}

export interface SpinnerHandle {
  readonly update: (text: string) => Effect.Effect<void>;
  readonly succeed: (text?: string) => Effect.Effect<void>;
  readonly fail: (text?: string) => Effect.Effect<void>;
  readonly warn: (text?: string) => Effect.Effect<void>;
  readonly stop: () => Effect.Effect<void>;
}

const defaultConfig: Required<SpinnerConfig> = {
  type: "dots",
  text: "",
  interval: 80,
  stream: process.stderr,
  indent: 2,
};

/**
 * Create and start an animated spinner.
 * Returns a handle to update, succeed, fail, or stop the spinner.
 */
export function createSpinner(
  config: SpinnerConfig = {},
): Effect.Effect<SpinnerHandle> {
  return Effect.gen(function* () {
    const opts = { ...defaultConfig, ...config };
    const frames = spinnerFrames[opts.type];
    const frameCount = frames.length;
    const indent = " ".repeat(opts.indent);

    const frameRef = yield* Ref.make(0);
    const textRef = yield* Ref.make(opts.text);
    const runningRef = yield* Ref.make(true);

    const render = Effect.gen(function* () {
      const running = yield* Ref.get(runningRef);
      if (!running) return;

      const frame = yield* Ref.get(frameRef);
      const text = yield* Ref.get(textRef);

      const spinnerChar = frames[frame % frameCount];
      const line = `${indent}${semantic.primary(spinnerChar!)} ${text}`;

      opts.stream.write(`${ansi.clearLine}\r${line}`);
      yield* Ref.update(frameRef, (f) => f + 1);
    });

    const spinnerFiber = yield* Effect.fork(
      render.pipe(
        Effect.repeat(Schedule.spaced(opts.interval)),
        Effect.interruptible,
      ),
    );

    const stopSpinner = (
      symbol: string,
      finalText: string | undefined,
      currentText: string,
    ) =>
      Effect.gen(function* () {
        yield* Ref.set(runningRef, false);
        yield* Fiber.interrupt(spinnerFiber);
        const displayText = finalText ?? currentText;
        opts.stream.write(`${ansi.clearLine}\r${indent}${symbol} ${displayText}\n`);
      });

    const handle: SpinnerHandle = {
      update: (text: string) => Ref.set(textRef, text),

      succeed: (text?: string) =>
        Effect.gen(function* () {
          const currentText = yield* Ref.get(textRef);
          yield* stopSpinner(semantic.success(symbols.success), text, currentText);
        }),

      fail: (text?: string) =>
        Effect.gen(function* () {
          const currentText = yield* Ref.get(textRef);
          yield* stopSpinner(semantic.error(symbols.error), text, currentText);
        }),

      warn: (text?: string) =>
        Effect.gen(function* () {
          const currentText = yield* Ref.get(textRef);
          yield* stopSpinner(semantic.warning(symbols.warning), text, currentText);
        }),

      stop: () =>
        Effect.gen(function* () {
          yield* Ref.set(runningRef, false);
          yield* Fiber.interrupt(spinnerFiber);
          opts.stream.write(`${ansi.clearLine}\r`);
        }),
    };

    return handle;
  });
}

/**
 * Run an effect with a spinner, automatically showing success/fail.
 */
export function withSpinner<A, E>(
  text: string,
  effect: Effect.Effect<A, E>,
  config?: Omit<SpinnerConfig, "text">,
): Effect.Effect<A, E> {
  return Effect.gen(function* () {
    const spinner = yield* createSpinner({ ...config, text });

    const result = yield* effect.pipe(
      Effect.tapError(() => spinner.fail()),
      Effect.tap(() => spinner.succeed()),
      Effect.onInterrupt(() => spinner.stop()),
    );

    return result;
  });
}

/**
 * Run multiple effects in sequence with a spinner for each.
 */
export interface SpinnerTask<A, E> {
  readonly text: string;
  readonly effect: Effect.Effect<A, E>;
  readonly successText?: string;
  readonly failText?: string;
}

export function withSpinnerTasks<A, E>(
  tasks: readonly SpinnerTask<A, E>[],
  config?: Omit<SpinnerConfig, "text">,
): Effect.Effect<A[], E> {
  return Effect.gen(function* () {
    const results: A[] = [];

    for (const task of tasks) {
      const spinner = yield* createSpinner({ ...config, text: task.text });

      const result = yield* task.effect.pipe(
        Effect.tapError(() => spinner.fail(task.failText)),
        Effect.tap(() => spinner.succeed(task.successText ?? task.text)),
        Effect.onInterrupt(() => spinner.stop()),
      );

      results.push(result);
    }

    return results;
  });
}

/**
 * Simple static spinner message (non-animated, for non-TTY environments).
 */
export function staticSpinner(text: string): Effect.Effect<void> {
  return Effect.sync(() => {
    process.stderr.write(`  ${symbols.refresh} ${text}...\n`);
  });
}

/**
 * Check if the terminal supports interactive spinners.
 */
export function isInteractive(): boolean {
  return process.stderr.isTTY === true;
}

/**
 * Run with spinner if interactive, otherwise show static message.
 */
export function withSpinnerAuto<A, E>(
  text: string,
  effect: Effect.Effect<A, E>,
  config?: Omit<SpinnerConfig, "text">,
): Effect.Effect<A, E> {
  if (isInteractive()) {
    return withSpinner(text, effect, config);
  }
  return Effect.gen(function* () {
    yield* staticSpinner(text);
    return yield* effect;
  });
}
