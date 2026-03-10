/**
 * Task runner with status tracking for multi-step operations.
 */

import { Effect, Ref } from "effect";
import { ansi, semantic } from "./colors";
import { symbols } from "./symbols";

export type TaskStatus = "pending" | "running" | "success" | "failed" | "skipped" | "warning";

export interface Task<A = void, E = never> {
  readonly id: string;
  readonly title: string;
  readonly run: Effect.Effect<A, E>;
  readonly skip?: Effect.Effect<boolean>;
  readonly skipMessage?: string;
}

export interface TaskResult<A = void> {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly result?: A;
  readonly error?: unknown;
  readonly duration: number;
}

export interface TaskListConfig {
  readonly concurrent?: boolean;
  readonly stopOnError?: boolean;
  readonly showDuration?: boolean;
  readonly indent?: number;
  readonly stream?: NodeJS.WriteStream;
}

interface TaskState {
  readonly id: string;
  readonly title: string;
  status: TaskStatus;
  message?: string;
  duration?: number;
}

const statusIcon: Record<TaskStatus, string> = {
  pending: semantic.muted(symbols.circle),
  running: semantic.primary(symbols.circleDotted),
  success: semantic.success(symbols.success),
  failed: semantic.error(symbols.error),
  skipped: semantic.muted(symbols.middleDot),
  warning: semantic.warning(symbols.warning),
};

/**
 * Run a list of tasks with status display.
 */
export function runTasks<A, E>(
  tasks: readonly Task<A, E>[],
  config: TaskListConfig = {},
): Effect.Effect<TaskResult<A>[], E> {
  const {
    stopOnError = true,
    showDuration = true,
    indent = 2,
    stream = process.stderr,
  } = config;

  return Effect.gen(function* () {
    const indentStr = " ".repeat(indent);
    const tasksStateRef = yield* Ref.make<TaskState[]>(
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: "pending" as TaskStatus,
      })),
    );
    const renderedLinesRef = yield* Ref.make(0);

    const render = Effect.gen(function* () {
      const tasksState = yield* Ref.get(tasksStateRef);
      const renderedLines = yield* Ref.get(renderedLinesRef);

      // Move cursor up to overwrite
      if (renderedLines > 0) {
        stream.write(ansi.cursorUp(renderedLines));
      }

      for (const task of tasksState) {
        const icon = statusIcon[task.status];
        const titleStyle: Record<TaskStatus, (text: string) => string> = {
          running: semantic.primary,
          failed: semantic.error,
          skipped: semantic.muted,
          pending: (t) => t,
          success: (t) => t,
          warning: (t) => t,
        };
        const title = titleStyle[task.status](task.title);

        const duration =
          showDuration && task.duration
            ? ` ${semantic.muted(`(${task.duration}ms)`)}`
            : "";

        const message = task.message
          ? ` ${semantic.muted(task.message)}`
          : "";

        stream.write(`${ansi.clearLine}${indentStr}${icon} ${title}${duration}${message}\n`);
      }

      yield* Ref.set(renderedLinesRef, tasksState.length);
    });

    const updateTask = (
      id: string,
      update: Partial<TaskState>,
    ) =>
      Effect.gen(function* () {
        yield* Ref.update(tasksStateRef, (states) =>
          states.map((s) =>
            s.id === id ? { ...s, ...update } : s,
          ),
        );
        yield* render;
      });

    const results: TaskResult<A>[] = [];
    let hasError = false;

    // Initial render
    yield* render;

    for (const task of tasks) {
      if (hasError && stopOnError) {
        yield* updateTask(task.id, {
          status: "skipped",
          message: "skipped due to previous error",
        });
        results.push({
          id: task.id,
          title: task.title,
          status: "skipped",
          duration: 0,
        });
        continue;
      }

      // Check skip condition
      if (task.skip) {
        const shouldSkip = yield* task.skip;
        if (shouldSkip) {
          yield* updateTask(task.id, {
            status: "skipped",
            message: task.skipMessage ?? "skipped",
          });
          results.push({
            id: task.id,
            title: task.title,
            status: "skipped",
            duration: 0,
          });
          continue;
        }
      }

      // Run the task
      yield* updateTask(task.id, { status: "running" });
      const startTime = Date.now();

      const result = yield* task.run.pipe(
        Effect.map((value) => ({
          success: true as const,
          value,
          duration: Date.now() - startTime,
        })),
        Effect.catchAll((error) =>
          Effect.succeed({
            success: false as const,
            error,
            duration: Date.now() - startTime,
          }),
        ),
      );

      if (result.success) {
        yield* updateTask(task.id, {
          status: "success",
          duration: result.duration,
        });
        results.push({
          id: task.id,
          title: task.title,
          status: "success",
          result: result.value,
          duration: result.duration,
        });
      } else {
        hasError = true;
        yield* updateTask(task.id, {
          status: "failed",
          duration: result.duration,
          message: String(result.error),
        });
        results.push({
          id: task.id,
          title: task.title,
          status: "failed",
          error: result.error,
          duration: result.duration,
        });

        if (stopOnError) {
          return yield* Effect.fail(result.error as E);
        }
      }
    }

    return results;
  });
}

/**
 * Create a simple task.
 */
export function task<A, E>(
  id: string,
  title: string,
  run: Effect.Effect<A, E>,
  options?: {
    skip?: Effect.Effect<boolean>;
    skipMessage?: string;
  },
): Task<A, E> {
  return {
    id,
    title,
    run,
    skip: options?.skip,
    skipMessage: options?.skipMessage,
  };
}

/**
 * Simple logging utilities for task output.
 */
export const log = {
  title: (text: string, options?: { indent?: number }): Effect.Effect<void> =>
    Effect.sync(() => {
      const indent = " ".repeat(options?.indent ?? 0);
      console.log(`\n${indent}${semantic.header(text)}`);
    }),

  step: (text: string, options?: { indent?: number }): Effect.Effect<void> =>
    Effect.sync(() => {
      const indent = " ".repeat(options?.indent ?? 2);
      console.log(`${indent}${semantic.primary(symbols.arrowRight)} ${text}`);
    }),

  success: (text: string, options?: { indent?: number }): Effect.Effect<void> =>
    Effect.sync(() => {
      const indent = " ".repeat(options?.indent ?? 2);
      console.log(`${indent}${semantic.success(symbols.success)} ${text}`);
    }),

  error: (text: string, options?: { indent?: number }): Effect.Effect<void> =>
    Effect.sync(() => {
      const indent = " ".repeat(options?.indent ?? 2);
      console.log(`${indent}${semantic.error(symbols.error)} ${text}`);
    }),

  warning: (text: string, options?: { indent?: number }): Effect.Effect<void> =>
    Effect.sync(() => {
      const indent = " ".repeat(options?.indent ?? 2);
      console.log(`${indent}${semantic.warning(symbols.warning)} ${text}`);
    }),

  info: (text: string, options?: { indent?: number }): Effect.Effect<void> =>
    Effect.sync(() => {
      const indent = " ".repeat(options?.indent ?? 2);
      console.log(`${indent}${semantic.info(symbols.info)} ${text}`);
    }),

  muted: (text: string, options?: { indent?: number }): Effect.Effect<void> =>
    Effect.sync(() => {
      const indent = " ".repeat(options?.indent ?? 2);
      console.log(`${indent}${semantic.muted(text)}`);
    }),

  newline: (): Effect.Effect<void> =>
    Effect.sync(() => {
      console.log("");
    }),

  divider: (options?: {
    width?: number;
    char?: string;
    indent?: number;
  }): Effect.Effect<void> =>
    Effect.sync(() => {
      const width = options?.width ?? 50;
      const char = options?.char ?? symbols.boxHorizontal;
      const indent = " ".repeat(options?.indent ?? 0);
      console.log(`${indent}${semantic.muted(char.repeat(width))}`);
    }),
};

/**
 * Print a summary of task results.
 */
export function printTaskSummary(
  results: readonly TaskResult[],
  options?: { indent?: number },
): Effect.Effect<void> {
  return Effect.sync(() => {
    const indent = " ".repeat(options?.indent ?? 2);
    const success = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const total = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log("");
    console.log(`${indent}${semantic.header("Summary")}`);

    if (failed > 0) {
      console.log(
        `${indent}  ${semantic.error(symbols.error)} ${failed} failed`,
      );
    }
    if (success > 0) {
      console.log(
        `${indent}  ${semantic.success(symbols.success)} ${success} succeeded`,
      );
    }
    if (skipped > 0) {
      console.log(
        `${indent}  ${semantic.muted(symbols.middleDot)} ${skipped} skipped`,
      );
    }

    console.log(
      `${indent}  ${semantic.muted(`Total: ${total} tasks in ${totalDuration}ms`)}`,
    );
    console.log("");
  });
}

/**
 * Wrap an effect with pre/post logging.
 */
export function withStepLog<A, E>(
  stepName: string,
  effect: Effect.Effect<A, E>,
  options?: {
    successMessage?: string;
    errorMessage?: string;
    indent?: number;
  },
): Effect.Effect<A, E> {
  return Effect.gen(function* () {
    yield* log.step(stepName, { indent: options?.indent });

    const result = yield* effect.pipe(
      Effect.tapError(() =>
        log.error(options?.errorMessage ?? `Failed: ${stepName}`, {
          indent: options?.indent,
        }),
      ),
      Effect.tap(() =>
        log.success(options?.successMessage ?? stepName, {
          indent: options?.indent,
        }),
      ),
    );

    return result;
  });
}
