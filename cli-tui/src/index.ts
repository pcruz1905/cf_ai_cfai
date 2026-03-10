/**
 * @sellhub/cli-tui - Fancy Terminal UI Components for Effect-TS
 *
 * A comprehensive TUI library for building beautiful CLI applications
 * with Effect-TS. Includes spinners, progress bars, tables, boxes,
 * interactive prompts, and task runners.
 */

// Colors and styling
export {
  ansi,
  color,
  style,
  styled,
  createStyle,
  semantic,
  stripAnsi,
  visibleLength,
  padEnd,
  padStart,
  center,
  truncate,
  rgb,
  bgRgb,
  color256,
  bgColor256,
  type ColorName,
  type StyleName,
} from "./colors";

// Unicode symbols
export { symbols, spinnerFrames, type SpinnerType } from "./symbols";

// Spinner
export {
  createSpinner,
  withSpinner,
  withSpinnerTasks,
  staticSpinner,
  isInteractive as isSpinnerInteractive,
  withSpinnerAuto,
  type SpinnerConfig,
  type SpinnerHandle,
  type SpinnerTask,
} from "./spinner";

// Progress bar
export {
  createProgress,
  withProgress,
  progressIndicator,
  createMultiProgress,
  type ProgressConfig,
  type ProgressHandle,
  type MultiProgressConfig,
  type MultiProgressHandle,
} from "./progress";

// Table
export {
  renderTable,
  printTable,
  quickTable,
  keyValueTable,
  statusTable,
  type TableColumn,
  type TableConfig,
  type StatusItem,
} from "./table";

// Box/Panel
export {
  renderBox,
  printBox,
  banner,
  sectionHeader,
  divider,
  infoBox,
  warningBox,
  errorBox,
  successBox,
  type BoxStyle,
  type BoxConfig,
} from "./box";

// Interactive prompts
export {
  isInteractive,
  confirm,
  input,
  password,
  select,
  multiSelect,
  nonInteractiveConfirm,
  autoConfirm,
  type SelectOption,
} from "./prompts";

// Task runner
export {
  runTasks,
  task,
  log,
  printTaskSummary,
  withStepLog,
  type TaskStatus,
  type Task,
  type TaskResult,
  type TaskListConfig,
} from "./tasks";
