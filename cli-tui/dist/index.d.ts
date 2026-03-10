import { Effect } from 'effect';

/**
 * ANSI color codes and styling utilities for terminal output.
 */
declare const ansi: {
    readonly reset: "\u001B[0m";
    readonly bold: "\u001B[1m";
    readonly dim: "\u001B[2m";
    readonly italic: "\u001B[3m";
    readonly underline: "\u001B[4m";
    readonly blink: "\u001B[5m";
    readonly inverse: "\u001B[7m";
    readonly hidden: "\u001B[8m";
    readonly strikethrough: "\u001B[9m";
    readonly black: "\u001B[30m";
    readonly red: "\u001B[31m";
    readonly green: "\u001B[32m";
    readonly yellow: "\u001B[33m";
    readonly blue: "\u001B[34m";
    readonly magenta: "\u001B[35m";
    readonly cyan: "\u001B[36m";
    readonly white: "\u001B[37m";
    readonly gray: "\u001B[90m";
    readonly brightRed: "\u001B[91m";
    readonly brightGreen: "\u001B[92m";
    readonly brightYellow: "\u001B[93m";
    readonly brightBlue: "\u001B[94m";
    readonly brightMagenta: "\u001B[95m";
    readonly brightCyan: "\u001B[96m";
    readonly brightWhite: "\u001B[97m";
    readonly bgBlack: "\u001B[40m";
    readonly bgRed: "\u001B[41m";
    readonly bgGreen: "\u001B[42m";
    readonly bgYellow: "\u001B[43m";
    readonly bgBlue: "\u001B[44m";
    readonly bgMagenta: "\u001B[45m";
    readonly bgCyan: "\u001B[46m";
    readonly bgWhite: "\u001B[47m";
    readonly cursorUp: (n?: number) => string;
    readonly cursorDown: (n?: number) => string;
    readonly cursorForward: (n?: number) => string;
    readonly cursorBack: (n?: number) => string;
    readonly cursorTo: (x: number, y?: number) => string;
    readonly cursorSave: "\u001B[s";
    readonly cursorRestore: "\u001B[u";
    readonly cursorHide: "\u001B[?25l";
    readonly cursorShow: "\u001B[?25h";
    readonly clearLine: "\u001B[2K";
    readonly clearLineEnd: "\u001B[0K";
    readonly clearLineStart: "\u001B[1K";
    readonly clearScreen: "\u001B[2J";
    readonly clearScreenDown: "\u001B[0J";
    readonly clearScreenUp: "\u001B[1J";
};
type ColorName = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "gray" | "brightRed" | "brightGreen" | "brightYellow" | "brightBlue" | "brightMagenta" | "brightCyan" | "brightWhite";
type StyleName = "bold" | "dim" | "italic" | "underline" | "inverse" | "strikethrough";
/**
 * Apply a color to text.
 */
declare function color(text: string, colorName: ColorName): string;
/**
 * Apply a style to text.
 */
declare function style(text: string, styleName: StyleName): string;
/**
 * Apply multiple styles/colors to text.
 */
declare function styled(text: string, ...styles: Array<ColorName | StyleName>): string;
/**
 * Create a reusable styled function.
 */
declare function createStyle(...styles: Array<ColorName | StyleName>): (text: string) => string;
declare const semantic: {
    readonly success: (text: string) => string;
    readonly error: (text: string) => string;
    readonly warning: (text: string) => string;
    readonly info: (text: string) => string;
    readonly muted: (text: string) => string;
    readonly highlight: (text: string) => string;
    readonly primary: (text: string) => string;
    readonly secondary: (text: string) => string;
    readonly accent: (text: string) => string;
    readonly link: (text: string) => string;
    readonly code: (text: string) => string;
    readonly header: (text: string) => string;
    readonly label: (text: string) => string;
    readonly value: (text: string) => string;
};
/**
 * Strip ANSI codes from a string.
 */
declare function stripAnsi(text: string): string;
/**
 * Get visible length of a string (excluding ANSI codes).
 */
declare function visibleLength(text: string): number;
/**
 * Pad a string to a specific visible width (accounting for ANSI codes).
 */
declare function padEnd(text: string, width: number, char?: string): string;
declare function padStart(text: string, width: number, char?: string): string;
declare function center(text: string, width: number, char?: string): string;
/**
 * Truncate text to a maximum visible width.
 */
declare function truncate(text: string, maxWidth: number, suffix?: string): string;
/**
 * RGB color support (256-color terminals).
 */
declare function rgb(r: number, g: number, b: number): string;
declare function bgRgb(r: number, g: number, b: number): string;
/**
 * 256-color support.
 */
declare function color256(n: number): string;
declare function bgColor256(n: number): string;

/**
 * Unicode symbols for terminal output.
 */
declare const symbols: {
    readonly success: "√" | "✔";
    readonly error: "×" | "✘";
    readonly warning: "⚠";
    readonly info: "ℹ";
    readonly question: "?";
    readonly spinner: readonly ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    readonly spinnerDots: readonly ["⠁", "⠂", "⠄", "⡀", "⢀", "⠠", "⠐", "⠈"];
    readonly spinnerLine: readonly ["-", "\\", "|", "/"];
    readonly spinnerCircle: readonly ["◐", "◓", "◑", "◒"];
    readonly spinnerArc: readonly ["◜", "◝", "◞", "◟"];
    readonly spinnerBounce: readonly ["⠁", "⠄", "⠂", "⠈"];
    readonly spinnerArrow: readonly ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"];
    readonly arrowRight: "→";
    readonly arrowLeft: "←";
    readonly arrowUp: "↑";
    readonly arrowDown: "↓";
    readonly arrowRightFilled: "▶";
    readonly arrowLeftFilled: "◀";
    readonly arrowUpFilled: "▲";
    readonly arrowDownFilled: "▼";
    readonly pointer: ">" | "❯";
    readonly pointerSmall: ">" | "›";
    readonly bullet: "•";
    readonly bulletWhite: "◦";
    readonly star: "★";
    readonly starEmpty: "☆";
    readonly heart: "♥";
    readonly diamond: "◆";
    readonly diamondSmall: "◈";
    readonly square: "■";
    readonly squareSmall: "▪";
    readonly squareEmpty: "□";
    readonly circle: "●";
    readonly circleEmpty: "○";
    readonly circleDotted: "◌";
    readonly progressFull: "█";
    readonly progressHalf: "▌";
    readonly progressEmpty: "░";
    readonly progressLight: "▒";
    readonly progressMedium: "▓";
    readonly boxTopLeft: "┌";
    readonly boxTopRight: "┐";
    readonly boxBottomLeft: "└";
    readonly boxBottomRight: "┘";
    readonly boxHorizontal: "─";
    readonly boxVertical: "│";
    readonly boxCross: "┼";
    readonly boxTeeLeft: "┤";
    readonly boxTeeRight: "├";
    readonly boxTeeTop: "┴";
    readonly boxTeeBottom: "┬";
    readonly boxDoubleTopLeft: "╔";
    readonly boxDoubleTopRight: "╗";
    readonly boxDoubleBottomLeft: "╚";
    readonly boxDoubleBottomRight: "╝";
    readonly boxDoubleHorizontal: "═";
    readonly boxDoubleVertical: "║";
    readonly boxRoundTopLeft: "╭";
    readonly boxRoundTopRight: "╮";
    readonly boxRoundBottomLeft: "╰";
    readonly boxRoundBottomRight: "╯";
    readonly boxHeavyTopLeft: "┏";
    readonly boxHeavyTopRight: "┓";
    readonly boxHeavyBottomLeft: "┗";
    readonly boxHeavyBottomRight: "┛";
    readonly boxHeavyHorizontal: "━";
    readonly boxHeavyVertical: "┃";
    readonly ellipsis: "…";
    readonly middleDot: "·";
    readonly dash: "—";
    readonly radioOn: "◉";
    readonly radioOff: "◎";
    readonly checkboxOn: "☒";
    readonly checkboxOff: "☐";
    readonly play: "▶";
    readonly pause: "⏸";
    readonly stop: "■";
    readonly refresh: "↻";
    readonly lightning: "⚡";
    readonly gear: "⚙";
    readonly wrench: "🔧";
    readonly package: "📦";
    readonly rocket: "🚀";
    readonly fire: "🔥";
    readonly sparkles: "✨";
    readonly tada: "🎉";
    readonly clock: "🕐";
    readonly folder: "📁";
    readonly file: "📄";
    readonly link: "🔗";
    readonly lock: "🔒";
    readonly key: "🔑";
    readonly cloud: "☁";
    readonly sun: "☀";
    readonly moon: "🌙";
};
declare const spinnerFrames: {
    readonly dots: readonly ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    readonly dots2: readonly ["⠁", "⠂", "⠄", "⡀", "⢀", "⠠", "⠐", "⠈"];
    readonly line: readonly ["-", "\\", "|", "/"];
    readonly circle: readonly ["◐", "◓", "◑", "◒"];
    readonly arc: readonly ["◜", "◝", "◞", "◟"];
    readonly bounce: readonly ["⠁", "⠄", "⠂", "⠈"];
    readonly arrow: readonly ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"];
};
type SpinnerType = keyof typeof spinnerFrames;

/**
 * Animated spinner for long-running operations.
 */

interface SpinnerConfig {
    readonly type?: SpinnerType;
    readonly text?: string;
    readonly interval?: number;
    readonly stream?: NodeJS.WriteStream;
    readonly indent?: number;
}
interface SpinnerHandle {
    readonly update: (text: string) => Effect.Effect<void>;
    readonly succeed: (text?: string) => Effect.Effect<void>;
    readonly fail: (text?: string) => Effect.Effect<void>;
    readonly warn: (text?: string) => Effect.Effect<void>;
    readonly stop: () => Effect.Effect<void>;
}
/**
 * Create and start an animated spinner.
 * Returns a handle to update, succeed, fail, or stop the spinner.
 */
declare function createSpinner(config?: SpinnerConfig): Effect.Effect<SpinnerHandle>;
/**
 * Run an effect with a spinner, automatically showing success/fail.
 */
declare function withSpinner<A, E>(text: string, effect: Effect.Effect<A, E>, config?: Omit<SpinnerConfig, "text">): Effect.Effect<A, E>;
/**
 * Run multiple effects in sequence with a spinner for each.
 */
interface SpinnerTask<A, E> {
    readonly text: string;
    readonly effect: Effect.Effect<A, E>;
    readonly successText?: string;
    readonly failText?: string;
}
declare function withSpinnerTasks<A, E>(tasks: readonly SpinnerTask<A, E>[], config?: Omit<SpinnerConfig, "text">): Effect.Effect<A[], E>;
/**
 * Simple static spinner message (non-animated, for non-TTY environments).
 */
declare function staticSpinner(text: string): Effect.Effect<void>;
/**
 * Check if the terminal supports interactive spinners.
 */
declare function isInteractive$1(): boolean;
/**
 * Run with spinner if interactive, otherwise show static message.
 */
declare function withSpinnerAuto<A, E>(text: string, effect: Effect.Effect<A, E>, config?: Omit<SpinnerConfig, "text">): Effect.Effect<A, E>;

/**
 * Progress bar for tracking completion.
 */

interface ProgressConfig {
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
interface ProgressHandle {
    readonly increment: (amount?: number) => Effect.Effect<void>;
    readonly update: (current: number) => Effect.Effect<void>;
    readonly setLabel: (label: string) => Effect.Effect<void>;
    readonly complete: () => Effect.Effect<void>;
    readonly fail: (message?: string) => Effect.Effect<void>;
}
/**
 * Create a progress bar.
 */
declare function createProgress(config: ProgressConfig): Effect.Effect<ProgressHandle>;
/**
 * Run an effect while tracking progress.
 */
declare function withProgress<A, E>(items: readonly A[], process: (item: A, index: number) => Effect.Effect<void, E>, config?: Omit<ProgressConfig, "total">): Effect.Effect<void, E>;
/**
 * Simple inline progress indicator.
 */
declare function progressIndicator(current: number, total: number, label?: string): string;
/**
 * Multi-progress for tracking multiple concurrent operations.
 */
interface MultiProgressConfig {
    readonly stream?: NodeJS.WriteStream;
    readonly indent?: number;
}
interface MultiProgressHandle {
    readonly addTask: (id: string, label: string, total: number) => Effect.Effect<void>;
    readonly updateTask: (id: string, current: number, label?: string) => Effect.Effect<void>;
    readonly completeTask: (id: string, label?: string) => Effect.Effect<void>;
    readonly failTask: (id: string, label?: string) => Effect.Effect<void>;
    readonly done: () => Effect.Effect<void>;
}
declare function createMultiProgress(config?: MultiProgressConfig): Effect.Effect<MultiProgressHandle>;

/**
 * Table formatting for structured data display.
 */

interface TableColumn<T> {
    readonly header: string;
    readonly key?: keyof T;
    readonly accessor?: (row: T, index: number) => string;
    readonly width?: number;
    readonly align?: "left" | "center" | "right";
    readonly headerAlign?: "left" | "center" | "right";
}
interface TableConfig<T> {
    readonly columns: readonly TableColumn<T>[];
    readonly data: readonly T[];
    readonly style?: "simple" | "box" | "rounded" | "heavy" | "double" | "minimal";
    readonly indent?: number;
    readonly headerStyle?: (text: string) => string;
    readonly rowStyle?: (text: string, row: T, index: number) => string;
    readonly showHeader?: boolean;
    readonly showRowNumbers?: boolean;
    readonly maxWidth?: number;
}
/**
 * Render a table as an array of strings.
 */
declare function renderTable<T>(config: TableConfig<T>): string[];
/**
 * Print a table to the console.
 */
declare function printTable<T>(config: TableConfig<T>): Effect.Effect<void>;
/**
 * Quick table printing from an array of objects.
 */
declare function quickTable<T extends Record<string, unknown>>(data: readonly T[], options?: {
    columns?: readonly (keyof T)[];
    style?: TableConfig<T>["style"];
    indent?: number;
}): Effect.Effect<void>;
/**
 * Simple key-value pair display.
 */
declare function keyValueTable(pairs: readonly (readonly [string, string])[], options?: {
    indent?: number;
    keyStyle?: (text: string) => string;
    valueStyle?: (text: string) => string;
    separator?: string;
}): Effect.Effect<void>;
/**
 * Status table for showing status of multiple items.
 */
interface StatusItem {
    readonly name: string;
    readonly status: "success" | "error" | "warning" | "pending" | "running";
    readonly message?: string;
}
declare function statusTable(items: readonly StatusItem[], options?: {
    indent?: number;
}): Effect.Effect<void>;

/**
 * Box/panel drawing for terminal output.
 */

type BoxStyle = "single" | "double" | "rounded" | "heavy" | "none";
interface BoxConfig {
    readonly title?: string;
    readonly style?: BoxStyle;
    readonly padding?: number;
    readonly margin?: number;
    readonly width?: number;
    readonly align?: "left" | "center" | "right";
    readonly titleAlign?: "left" | "center" | "right";
    readonly borderColor?: (text: string) => string;
    readonly titleColor?: (text: string) => string;
}
/**
 * Render content inside a box.
 */
declare function renderBox(content: string | readonly string[], config?: BoxConfig): string[];
/**
 * Print a boxed message to the console.
 */
declare function printBox(content: string | readonly string[], config?: BoxConfig): Effect.Effect<void>;
/**
 * Print a header banner.
 */
declare function banner(text: string, config?: Omit<BoxConfig, "style" | "padding">): Effect.Effect<void>;
/**
 * Print a section header.
 */
declare function sectionHeader(text: string, options?: {
    width?: number;
    char?: string;
}): Effect.Effect<void>;
/**
 * Print a divider line.
 */
declare function divider(options?: {
    width?: number;
    char?: string;
    style?: (text: string) => string;
}): Effect.Effect<void>;
/**
 * Print an info/notice box.
 */
declare function infoBox(content: string | readonly string[], config?: Omit<BoxConfig, "borderColor">): Effect.Effect<void>;
/**
 * Print a warning box.
 */
declare function warningBox(content: string | readonly string[], config?: Omit<BoxConfig, "borderColor">): Effect.Effect<void>;
/**
 * Print an error box.
 */
declare function errorBox(content: string | readonly string[], config?: Omit<BoxConfig, "borderColor">): Effect.Effect<void>;
/**
 * Print a success box.
 */
declare function successBox(content: string | readonly string[], config?: Omit<BoxConfig, "borderColor">): Effect.Effect<void>;

/**
 * Interactive prompts for user input.
 */

/**
 * Check if stdin is interactive (TTY).
 */
declare function isInteractive(): boolean;
/**
 * Prompt for yes/no confirmation.
 */
declare function confirm(message: string, options?: {
    defaultValue?: boolean;
}): Effect.Effect<boolean>;
/**
 * Prompt for text input.
 */
declare function input(message: string, options?: {
    defaultValue?: string;
    placeholder?: string;
    validate?: (value: string) => string | null;
}): Effect.Effect<string>;
/**
 * Prompt for password input (hidden).
 */
declare function password(message: string, options?: {
    mask?: string;
    validate?: (value: string) => string | null;
}): Effect.Effect<string>;
interface SelectOption<T> {
    readonly label: string;
    readonly value: T;
    readonly hint?: string;
}
/**
 * Prompt for single selection from options.
 */
declare function select<T>(message: string, options: readonly SelectOption<T>[], config?: {
    defaultIndex?: number;
}): Effect.Effect<T>;
/**
 * Prompt for multiple selection from options.
 */
declare function multiSelect<T>(message: string, options: readonly SelectOption<T>[], config?: {
    defaultSelected?: readonly number[];
    required?: boolean;
    min?: number;
    max?: number;
}): Effect.Effect<T[]>;
/**
 * Simple non-interactive fallback for confirmation.
 */
declare function nonInteractiveConfirm(message: string, defaultValue: boolean): Effect.Effect<boolean>;
/**
 * Auto-detect and use appropriate confirm function.
 */
declare function autoConfirm(message: string, options?: {
    defaultValue?: boolean;
}): Effect.Effect<boolean>;

/**
 * Task runner with status tracking for multi-step operations.
 */

type TaskStatus = "pending" | "running" | "success" | "failed" | "skipped" | "warning";
interface Task<A = void, E = never> {
    readonly id: string;
    readonly title: string;
    readonly run: Effect.Effect<A, E>;
    readonly skip?: Effect.Effect<boolean>;
    readonly skipMessage?: string;
}
interface TaskResult<A = void> {
    readonly id: string;
    readonly title: string;
    readonly status: TaskStatus;
    readonly result?: A;
    readonly error?: unknown;
    readonly duration: number;
}
interface TaskListConfig {
    readonly concurrent?: boolean;
    readonly stopOnError?: boolean;
    readonly showDuration?: boolean;
    readonly indent?: number;
    readonly stream?: NodeJS.WriteStream;
}
/**
 * Run a list of tasks with status display.
 */
declare function runTasks<A, E>(tasks: readonly Task<A, E>[], config?: TaskListConfig): Effect.Effect<TaskResult<A>[], E>;
/**
 * Create a simple task.
 */
declare function task<A, E>(id: string, title: string, run: Effect.Effect<A, E>, options?: {
    skip?: Effect.Effect<boolean>;
    skipMessage?: string;
}): Task<A, E>;
/**
 * Simple logging utilities for task output.
 */
declare const log: {
    title: (text: string, options?: {
        indent?: number;
    }) => Effect.Effect<void>;
    step: (text: string, options?: {
        indent?: number;
    }) => Effect.Effect<void>;
    success: (text: string, options?: {
        indent?: number;
    }) => Effect.Effect<void>;
    error: (text: string, options?: {
        indent?: number;
    }) => Effect.Effect<void>;
    warning: (text: string, options?: {
        indent?: number;
    }) => Effect.Effect<void>;
    info: (text: string, options?: {
        indent?: number;
    }) => Effect.Effect<void>;
    muted: (text: string, options?: {
        indent?: number;
    }) => Effect.Effect<void>;
    newline: () => Effect.Effect<void>;
    divider: (options?: {
        width?: number;
        char?: string;
        indent?: number;
    }) => Effect.Effect<void>;
};
/**
 * Print a summary of task results.
 */
declare function printTaskSummary(results: readonly TaskResult[], options?: {
    indent?: number;
}): Effect.Effect<void>;
/**
 * Wrap an effect with pre/post logging.
 */
declare function withStepLog<A, E>(stepName: string, effect: Effect.Effect<A, E>, options?: {
    successMessage?: string;
    errorMessage?: string;
    indent?: number;
}): Effect.Effect<A, E>;

export { type BoxConfig, type BoxStyle, type ColorName, type MultiProgressConfig, type MultiProgressHandle, type ProgressConfig, type ProgressHandle, type SelectOption, type SpinnerConfig, type SpinnerHandle, type SpinnerTask, type SpinnerType, type StatusItem, type StyleName, type TableColumn, type TableConfig, type Task, type TaskListConfig, type TaskResult, type TaskStatus, ansi, autoConfirm, banner, bgColor256, bgRgb, center, color, color256, confirm, createMultiProgress, createProgress, createSpinner, createStyle, divider, errorBox, infoBox, input, isInteractive, isInteractive$1 as isSpinnerInteractive, keyValueTable, log, multiSelect, nonInteractiveConfirm, padEnd, padStart, password, printBox, printTable, printTaskSummary, progressIndicator, quickTable, renderBox, renderTable, rgb, runTasks, sectionHeader, select, semantic, spinnerFrames, staticSpinner, statusTable, stripAnsi, style, styled, successBox, symbols, task, truncate, visibleLength, warningBox, withProgress, withSpinner, withSpinnerAuto, withSpinnerTasks, withStepLog };
