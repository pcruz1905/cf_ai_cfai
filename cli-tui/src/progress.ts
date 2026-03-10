/**
 * Progress bar for tracking completion.
 */

import { Effect, Ref } from "effect";
import { ansi, semantic } from "./colors";
import { symbols } from "./symbols";

export interface ProgressConfig {
  readonly total: number;
  readonly width?: number;
  readonly showPercentage?: boolean;
  readonly showCount?: boolean;
  readonly showEta?: boolean;
  readonly barChar?: string;
  readonly emptyChar?: string;
  readonly stream?: NodeJS.WriteStream;
  readonly label?: string;
  readonly indent?: number;
}

export interface ProgressHandle {
  readonly increment: (amount?: number) => Effect.Effect<void>;
  readonly update: (current: number) => Effect.Effect<void>;
  readonly setLabel: (label: string) => Effect.Effect<void>;
  readonly complete: () => Effect.Effect<void>;
  readonly fail: (message?: string) => Effect.Effect<void>;
}

const defaultConfig = {
  width: 30,
  showPercentage: true,
  showCount: true,
  showEta: false,
  barChar: symbols.progressFull,
  emptyChar: symbols.progressEmpty,
  stream: process.stderr,
  label: "",
  indent: 2,
};

/**
 * Create a progress bar.
 */
export function createProgress(
  config: ProgressConfig,
): Effect.Effect<ProgressHandle> {
  return Effect.gen(function* () {
    const opts = { ...defaultConfig, ...config };
    const indent = " ".repeat(opts.indent);

    const currentRef = yield* Ref.make(0);
    const labelRef = yield* Ref.make(opts.label);
    const startTime = Date.now();
    const completedRef = yield* Ref.make(false);

    const render = Effect.gen(function* () {
      const completed = yield* Ref.get(completedRef);
      if (completed) return;

      const current = yield* Ref.get(currentRef);
      const label = yield* Ref.get(labelRef);

      const percentage = Math.min(100, Math.round((current / opts.total) * 100));
      const filledWidth = Math.round((current / opts.total) * opts.width);
      const emptyWidth = opts.width - filledWidth;

      const bar =
        semantic.primary(opts.barChar.repeat(filledWidth)) +
        semantic.muted(opts.emptyChar.repeat(emptyWidth));

      const parts: string[] = [indent, bar];

      if (opts.showPercentage) {
        parts.push(` ${semantic.highlight(String(percentage).padStart(3))}%`);
      }

      if (opts.showCount) {
        parts.push(
          ` ${semantic.muted(`(${current}/${opts.total})`)}`,
        );
      }

      if (opts.showEta && current > 0) {
        const elapsed = Date.now() - startTime;
        const rate = current / elapsed;
        const remaining = (opts.total - current) / rate;
        const eta = formatDuration(remaining);
        parts.push(` ${semantic.muted(`ETA: ${eta}`)}`);
      }

      if (label) {
        parts.push(` ${label}`);
      }

      opts.stream.write(`${ansi.clearLine}\r${parts.join("")}`);
    });

    const handle: ProgressHandle = {
      increment: (amount = 1) =>
        Effect.gen(function* () {
          yield* Ref.update(currentRef, (c) => Math.min(opts.total, c + amount));
          yield* render;
        }),

      update: (current: number) =>
        Effect.gen(function* () {
          yield* Ref.set(currentRef, Math.min(opts.total, current));
          yield* render;
        }),

      setLabel: (label: string) =>
        Effect.gen(function* () {
          yield* Ref.set(labelRef, label);
          yield* render;
        }),

      complete: () =>
        Effect.gen(function* () {
          yield* Ref.set(currentRef, opts.total);
          yield* Ref.set(completedRef, true);
          yield* render;
          opts.stream.write(`\n`);
        }),

      fail: (message?: string) =>
        Effect.gen(function* () {
          yield* Ref.set(completedRef, true);
          const current = yield* Ref.get(currentRef);
          const text = message ?? `Failed at ${current}/${opts.total}`;
          opts.stream.write(`${ansi.clearLine}\r${indent}${semantic.error(symbols.error)} ${text}\n`);
        }),
    };

    // Initial render
    yield* render;

    return handle;
  });
}

/**
 * Format duration in human-readable format.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Run an effect while tracking progress.
 */
export function withProgress<A, E>(
  items: readonly A[],
  process: (item: A, index: number) => Effect.Effect<void, E>,
  config?: Omit<ProgressConfig, "total">,
): Effect.Effect<void, E> {
  return Effect.gen(function* () {
    const progress = yield* createProgress({
      ...config,
      total: items.length,
    });

    for (let i = 0; i < items.length; i++) {
      yield* process(items[i]!, i).pipe(
        Effect.tap(() => progress.increment()),
        Effect.tapError(() => progress.fail()),
      );
    }

    yield* progress.complete();
  });
}

/**
 * Simple inline progress indicator.
 */
export function progressIndicator(
  current: number,
  total: number,
  label?: string,
): string {
  const percentage = Math.round((current / total) * 100);
  const count = `${current}/${total}`;
  const labelPart = label ? ` ${label}` : "";
  return `${semantic.muted(`[${percentage}%]`)} ${semantic.secondary(count)}${labelPart}`;
}

/**
 * Multi-progress for tracking multiple concurrent operations.
 */
export interface MultiProgressConfig {
  readonly stream?: NodeJS.WriteStream;
  readonly indent?: number;
}

export interface MultiProgressHandle {
  readonly addTask: (id: string, label: string, total: number) => Effect.Effect<void>;
  readonly updateTask: (id: string, current: number, label?: string) => Effect.Effect<void>;
  readonly completeTask: (id: string, label?: string) => Effect.Effect<void>;
  readonly failTask: (id: string, label?: string) => Effect.Effect<void>;
  readonly done: () => Effect.Effect<void>;
}

interface TaskState {
  label: string;
  total: number;
  current: number;
  status: "running" | "complete" | "failed";
}

export function createMultiProgress(
  config: MultiProgressConfig = {},
): Effect.Effect<MultiProgressHandle> {
  return Effect.gen(function* () {
    const { stream = process.stderr, indent = 2 } = config;
    const indentStr = " ".repeat(indent);
    const tasksRef = yield* Ref.make<Map<string, TaskState>>(new Map());
    const lineCountRef = yield* Ref.make(0);

    const render = Effect.gen(function* () {
      const tasks = yield* Ref.get(tasksRef);
      const lineCount = yield* Ref.get(lineCountRef);

      // Move cursor up to overwrite previous output
      if (lineCount > 0) {
        stream.write(ansi.cursorUp(lineCount));
      }

      let lines = 0;
      for (const [, task] of tasks) {
        const percentage = Math.round((task.current / task.total) * 100);
        const statusIconMap: Record<TaskState["status"], string> = {
          complete: semantic.success(symbols.success),
          failed: semantic.error(symbols.error),
          running: semantic.primary(symbols.circle),
        };
        const statusIcon = statusIconMap[task.status];

        const progressText = task.status === "running"
          ? ` ${semantic.muted(`${percentage}%`)}`
          : "";

        stream.write(`${ansi.clearLine}${indentStr}${statusIcon} ${task.label}${progressText}\n`);
        lines++;
      }

      yield* Ref.set(lineCountRef, lines);
    });

    const handle: MultiProgressHandle = {
      addTask: (id, label, total) =>
        Effect.gen(function* () {
          yield* Ref.update(tasksRef, (tasks) => {
            const newTasks = new Map(tasks);
            newTasks.set(id, { label, total, current: 0, status: "running" });
            return newTasks;
          });
          yield* render;
        }),

      updateTask: (id, current, label) =>
        Effect.gen(function* () {
          yield* Ref.update(tasksRef, (tasks) => {
            const newTasks = new Map(tasks);
            const task = newTasks.get(id);
            if (task) {
              newTasks.set(id, {
                ...task,
                current,
                label: label ?? task.label,
              });
            }
            return newTasks;
          });
          yield* render;
        }),

      completeTask: (id, label) =>
        Effect.gen(function* () {
          yield* Ref.update(tasksRef, (tasks) => {
            const newTasks = new Map(tasks);
            const task = newTasks.get(id);
            if (task) {
              newTasks.set(id, {
                ...task,
                current: task.total,
                status: "complete",
                label: label ?? task.label,
              });
            }
            return newTasks;
          });
          yield* render;
        }),

      failTask: (id, label) =>
        Effect.gen(function* () {
          yield* Ref.update(tasksRef, (tasks) => {
            const newTasks = new Map(tasks);
            const task = newTasks.get(id);
            if (task) {
              newTasks.set(id, {
                ...task,
                status: "failed",
                label: label ?? task.label,
              });
            }
            return newTasks;
          });
          yield* render;
        }),

      done: () => Effect.void,
    };

    return handle;
  });
}
