// src/colors.ts
var ansi = {
  // Reset
  reset: "\x1B[0m",
  // Styles
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  italic: "\x1B[3m",
  underline: "\x1B[4m",
  blink: "\x1B[5m",
  inverse: "\x1B[7m",
  hidden: "\x1B[8m",
  strikethrough: "\x1B[9m",
  // Foreground colors
  black: "\x1B[30m",
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  white: "\x1B[37m",
  gray: "\x1B[90m",
  // Bright foreground colors
  brightRed: "\x1B[91m",
  brightGreen: "\x1B[92m",
  brightYellow: "\x1B[93m",
  brightBlue: "\x1B[94m",
  brightMagenta: "\x1B[95m",
  brightCyan: "\x1B[96m",
  brightWhite: "\x1B[97m",
  // Background colors
  bgBlack: "\x1B[40m",
  bgRed: "\x1B[41m",
  bgGreen: "\x1B[42m",
  bgYellow: "\x1B[43m",
  bgBlue: "\x1B[44m",
  bgMagenta: "\x1B[45m",
  bgCyan: "\x1B[46m",
  bgWhite: "\x1B[47m",
  // Cursor control
  cursorUp: (n = 1) => `\x1B[${n}A`,
  cursorDown: (n = 1) => `\x1B[${n}B`,
  cursorForward: (n = 1) => `\x1B[${n}C`,
  cursorBack: (n = 1) => `\x1B[${n}D`,
  cursorTo: (x, y) => y === void 0 ? `\x1B[${x}G` : `\x1B[${y};${x}H`,
  cursorSave: "\x1B[s",
  cursorRestore: "\x1B[u",
  cursorHide: "\x1B[?25l",
  cursorShow: "\x1B[?25h",
  // Line control
  clearLine: "\x1B[2K",
  clearLineEnd: "\x1B[0K",
  clearLineStart: "\x1B[1K",
  clearScreen: "\x1B[2J",
  clearScreenDown: "\x1B[0J",
  clearScreenUp: "\x1B[1J"
};
function color(text, colorName) {
  return `${ansi[colorName]}${text}${ansi.reset}`;
}
function style(text, styleName) {
  return `${ansi[styleName]}${text}${ansi.reset}`;
}
function styled(text, ...styles) {
  const codes = styles.map((s) => ansi[s]).join("");
  return `${codes}${text}${ansi.reset}`;
}
function createStyle(...styles) {
  const codes = styles.map((s) => ansi[s]).join("");
  return (text) => `${codes}${text}${ansi.reset}`;
}
var semantic = {
  success: createStyle("green"),
  error: createStyle("red", "bold"),
  warning: createStyle("yellow"),
  info: createStyle("blue"),
  muted: createStyle("dim"),
  highlight: createStyle("cyan", "bold"),
  primary: createStyle("brightCyan"),
  secondary: createStyle("gray"),
  accent: createStyle("magenta"),
  link: createStyle("blue", "underline"),
  code: createStyle("yellow"),
  header: createStyle("bold", "brightWhite"),
  label: createStyle("dim"),
  value: createStyle("white")
};
function stripAnsi(text) {
  const ansiPattern = new RegExp("\x1B\\[[0-9;]*[a-zA-Z]", "g");
  return text.replace(ansiPattern, "");
}
function visibleLength(text) {
  return stripAnsi(text).length;
}
function padEnd(text, width, char = " ") {
  const visible = visibleLength(text);
  if (visible >= width) return text;
  return text + char.repeat(width - visible);
}
function padStart(text, width, char = " ") {
  const visible = visibleLength(text);
  if (visible >= width) return text;
  return char.repeat(width - visible) + text;
}
function center(text, width, char = " ") {
  const visible = visibleLength(text);
  if (visible >= width) return text;
  const left = Math.floor((width - visible) / 2);
  const right = width - visible - left;
  return char.repeat(left) + text + char.repeat(right);
}
function truncate(text, maxWidth, suffix = "...") {
  if (visibleLength(text) <= maxWidth) return text;
  const stripped = stripAnsi(text);
  const truncated = stripped.slice(0, maxWidth - suffix.length);
  return truncated + suffix;
}
function rgb(r, g, b) {
  return `\x1B[38;2;${r};${g};${b}m`;
}
function bgRgb(r, g, b) {
  return `\x1B[48;2;${r};${g};${b}m`;
}
function color256(n) {
  return `\x1B[38;5;${n}m`;
}
function bgColor256(n) {
  return `\x1B[48;5;${n}m`;
}

// src/symbols.ts
var isWindows = process.platform === "win32";
var symbols = {
  // Status indicators
  success: isWindows ? "\u221A" : "\u2714",
  // checkmark
  error: isWindows ? "\xD7" : "\u2718",
  // x mark
  warning: "\u26A0",
  // warning triangle
  info: "\u2139",
  // info circle
  question: "?",
  // Progress
  spinner: ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"],
  spinnerDots: ["\u2801", "\u2802", "\u2804", "\u2840", "\u2880", "\u2820", "\u2810", "\u2808"],
  spinnerLine: ["-", "\\", "|", "/"],
  spinnerCircle: ["\u25D0", "\u25D3", "\u25D1", "\u25D2"],
  spinnerArc: ["\u25DC", "\u25DD", "\u25DE", "\u25DF"],
  spinnerBounce: ["\u2801", "\u2804", "\u2802", "\u2808"],
  spinnerArrow: ["\u2190", "\u2196", "\u2191", "\u2197", "\u2192", "\u2198", "\u2193", "\u2199"],
  // Arrows
  arrowRight: "\u2192",
  arrowLeft: "\u2190",
  arrowUp: "\u2191",
  arrowDown: "\u2193",
  arrowRightFilled: "\u25B6",
  arrowLeftFilled: "\u25C0",
  arrowUpFilled: "\u25B2",
  arrowDownFilled: "\u25BC",
  pointer: isWindows ? ">" : "\u276F",
  pointerSmall: isWindows ? ">" : "\u203A",
  // Bullets and list markers
  bullet: "\u2022",
  bulletWhite: "\u25E6",
  star: "\u2605",
  starEmpty: "\u2606",
  heart: "\u2665",
  diamond: "\u25C6",
  diamondSmall: "\u25C8",
  square: "\u25A0",
  squareSmall: "\u25AA",
  squareEmpty: "\u25A1",
  circle: "\u25CF",
  circleEmpty: "\u25CB",
  circleDotted: "\u25CC",
  // Progress bar components
  progressFull: "\u2588",
  progressHalf: "\u258C",
  progressEmpty: "\u2591",
  progressLight: "\u2592",
  progressMedium: "\u2593",
  // Box drawing (single line)
  boxTopLeft: "\u250C",
  boxTopRight: "\u2510",
  boxBottomLeft: "\u2514",
  boxBottomRight: "\u2518",
  boxHorizontal: "\u2500",
  boxVertical: "\u2502",
  boxCross: "\u253C",
  boxTeeLeft: "\u2524",
  boxTeeRight: "\u251C",
  boxTeeTop: "\u2534",
  boxTeeBottom: "\u252C",
  // Box drawing (double line)
  boxDoubleTopLeft: "\u2554",
  boxDoubleTopRight: "\u2557",
  boxDoubleBottomLeft: "\u255A",
  boxDoubleBottomRight: "\u255D",
  boxDoubleHorizontal: "\u2550",
  boxDoubleVertical: "\u2551",
  // Box drawing (rounded)
  boxRoundTopLeft: "\u256D",
  boxRoundTopRight: "\u256E",
  boxRoundBottomLeft: "\u2570",
  boxRoundBottomRight: "\u256F",
  // Box drawing (heavy)
  boxHeavyTopLeft: "\u250F",
  boxHeavyTopRight: "\u2513",
  boxHeavyBottomLeft: "\u2517",
  boxHeavyBottomRight: "\u251B",
  boxHeavyHorizontal: "\u2501",
  boxHeavyVertical: "\u2503",
  // Separators
  ellipsis: "\u2026",
  middleDot: "\xB7",
  dash: "\u2014",
  // Misc
  radioOn: "\u25C9",
  radioOff: "\u25CE",
  checkboxOn: "\u2612",
  checkboxOff: "\u2610",
  play: "\u25B6",
  pause: "\u23F8",
  stop: "\u25A0",
  refresh: "\u21BB",
  lightning: "\u26A1",
  gear: "\u2699",
  wrench: "\u{1F527}",
  package: "\u{1F4E6}",
  rocket: "\u{1F680}",
  fire: "\u{1F525}",
  sparkles: "\u2728",
  tada: "\u{1F389}",
  clock: "\u{1F550}",
  folder: "\u{1F4C1}",
  file: "\u{1F4C4}",
  link: "\u{1F517}",
  lock: "\u{1F512}",
  key: "\u{1F511}",
  cloud: "\u2601",
  sun: "\u2600",
  moon: "\u{1F319}"
};
var spinnerFrames = {
  dots: symbols.spinner,
  dots2: symbols.spinnerDots,
  line: symbols.spinnerLine,
  circle: symbols.spinnerCircle,
  arc: symbols.spinnerArc,
  bounce: symbols.spinnerBounce,
  arrow: symbols.spinnerArrow
};

// src/spinner.ts
import { Effect, Fiber, Ref, Schedule } from "effect";
var defaultConfig = {
  type: "dots",
  text: "",
  interval: 80,
  stream: process.stderr,
  indent: 2
};
function createSpinner(config = {}) {
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
      const line = `${indent}${semantic.primary(spinnerChar)} ${text}`;
      opts.stream.write(`${ansi.clearLine}\r${line}`);
      yield* Ref.update(frameRef, (f) => f + 1);
    });
    const spinnerFiber = yield* Effect.fork(
      render.pipe(
        Effect.repeat(Schedule.spaced(opts.interval)),
        Effect.interruptible
      )
    );
    const stopSpinner = (symbol, finalText, currentText) => Effect.gen(function* () {
      yield* Ref.set(runningRef, false);
      yield* Fiber.interrupt(spinnerFiber);
      const displayText = finalText ?? currentText;
      opts.stream.write(`${ansi.clearLine}\r${indent}${symbol} ${displayText}
`);
    });
    const handle = {
      update: (text) => Ref.set(textRef, text),
      succeed: (text) => Effect.gen(function* () {
        const currentText = yield* Ref.get(textRef);
        yield* stopSpinner(semantic.success(symbols.success), text, currentText);
      }),
      fail: (text) => Effect.gen(function* () {
        const currentText = yield* Ref.get(textRef);
        yield* stopSpinner(semantic.error(symbols.error), text, currentText);
      }),
      warn: (text) => Effect.gen(function* () {
        const currentText = yield* Ref.get(textRef);
        yield* stopSpinner(semantic.warning(symbols.warning), text, currentText);
      }),
      stop: () => Effect.gen(function* () {
        yield* Ref.set(runningRef, false);
        yield* Fiber.interrupt(spinnerFiber);
        opts.stream.write(`${ansi.clearLine}\r`);
      })
    };
    return handle;
  });
}
function withSpinner(text, effect, config) {
  return Effect.gen(function* () {
    const spinner = yield* createSpinner({ ...config, text });
    const result = yield* effect.pipe(
      Effect.tapError(() => spinner.fail()),
      Effect.tap(() => spinner.succeed()),
      Effect.onInterrupt(() => spinner.stop())
    );
    return result;
  });
}
function withSpinnerTasks(tasks, config) {
  return Effect.gen(function* () {
    const results = [];
    for (const task2 of tasks) {
      const spinner = yield* createSpinner({ ...config, text: task2.text });
      const result = yield* task2.effect.pipe(
        Effect.tapError(() => spinner.fail(task2.failText)),
        Effect.tap(() => spinner.succeed(task2.successText ?? task2.text)),
        Effect.onInterrupt(() => spinner.stop())
      );
      results.push(result);
    }
    return results;
  });
}
function staticSpinner(text) {
  return Effect.sync(() => {
    process.stderr.write(`  ${symbols.refresh} ${text}...
`);
  });
}
function isInteractive() {
  return process.stderr.isTTY === true;
}
function withSpinnerAuto(text, effect, config) {
  if (isInteractive()) {
    return withSpinner(text, effect, config);
  }
  return Effect.gen(function* () {
    yield* staticSpinner(text);
    return yield* effect;
  });
}

// src/progress.ts
import { Effect as Effect2, Ref as Ref2 } from "effect";
var defaultConfig2 = {
  width: 30,
  showPercentage: true,
  showCount: true,
  showEta: false,
  barChar: symbols.progressFull,
  emptyChar: symbols.progressEmpty,
  stream: process.stderr,
  label: "",
  indent: 2
};
function createProgress(config) {
  return Effect2.gen(function* () {
    const opts = { ...defaultConfig2, ...config };
    const indent = " ".repeat(opts.indent);
    const currentRef = yield* Ref2.make(0);
    const labelRef = yield* Ref2.make(opts.label);
    const startTime = Date.now();
    const completedRef = yield* Ref2.make(false);
    const render = Effect2.gen(function* () {
      const completed = yield* Ref2.get(completedRef);
      if (completed) return;
      const current = yield* Ref2.get(currentRef);
      const label = yield* Ref2.get(labelRef);
      const percentage = Math.min(100, Math.round(current / opts.total * 100));
      const filledWidth = Math.round(current / opts.total * opts.width);
      const emptyWidth = opts.width - filledWidth;
      const bar = semantic.primary(opts.barChar.repeat(filledWidth)) + semantic.muted(opts.emptyChar.repeat(emptyWidth));
      const parts = [indent, bar];
      if (opts.showPercentage) {
        parts.push(` ${semantic.highlight(String(percentage).padStart(3))}%`);
      }
      if (opts.showCount) {
        parts.push(
          ` ${semantic.muted(`(${current}/${opts.total})`)}`
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
    const handle = {
      increment: (amount = 1) => Effect2.gen(function* () {
        yield* Ref2.update(currentRef, (c) => Math.min(opts.total, c + amount));
        yield* render;
      }),
      update: (current) => Effect2.gen(function* () {
        yield* Ref2.set(currentRef, Math.min(opts.total, current));
        yield* render;
      }),
      setLabel: (label) => Effect2.gen(function* () {
        yield* Ref2.set(labelRef, label);
        yield* render;
      }),
      complete: () => Effect2.gen(function* () {
        yield* Ref2.set(currentRef, opts.total);
        yield* Ref2.set(completedRef, true);
        yield* render;
        opts.stream.write(`
`);
      }),
      fail: (message) => Effect2.gen(function* () {
        yield* Ref2.set(completedRef, true);
        const current = yield* Ref2.get(currentRef);
        const text = message ?? `Failed at ${current}/${opts.total}`;
        opts.stream.write(`${ansi.clearLine}\r${indent}${semantic.error(symbols.error)} ${text}
`);
      })
    };
    yield* render;
    return handle;
  });
}
function formatDuration(ms) {
  if (ms < 1e3) return `${Math.round(ms)}ms`;
  if (ms < 6e4) return `${Math.round(ms / 1e3)}s`;
  const minutes = Math.floor(ms / 6e4);
  const seconds = Math.round(ms % 6e4 / 1e3);
  return `${minutes}m ${seconds}s`;
}
function withProgress(items, process2, config) {
  return Effect2.gen(function* () {
    const progress = yield* createProgress({
      ...config,
      total: items.length
    });
    for (let i = 0; i < items.length; i++) {
      yield* process2(items[i], i).pipe(
        Effect2.tap(() => progress.increment()),
        Effect2.tapError(() => progress.fail())
      );
    }
    yield* progress.complete();
  });
}
function progressIndicator(current, total, label) {
  const percentage = Math.round(current / total * 100);
  const count = `${current}/${total}`;
  const labelPart = label ? ` ${label}` : "";
  return `${semantic.muted(`[${percentage}%]`)} ${semantic.secondary(count)}${labelPart}`;
}
function createMultiProgress(config = {}) {
  return Effect2.gen(function* () {
    const { stream = process.stderr, indent = 2 } = config;
    const indentStr = " ".repeat(indent);
    const tasksRef = yield* Ref2.make(/* @__PURE__ */ new Map());
    const lineCountRef = yield* Ref2.make(0);
    const render = Effect2.gen(function* () {
      const tasks = yield* Ref2.get(tasksRef);
      const lineCount = yield* Ref2.get(lineCountRef);
      if (lineCount > 0) {
        stream.write(ansi.cursorUp(lineCount));
      }
      let lines = 0;
      for (const [, task2] of tasks) {
        const percentage = Math.round(task2.current / task2.total * 100);
        const statusIconMap = {
          complete: semantic.success(symbols.success),
          failed: semantic.error(symbols.error),
          running: semantic.primary(symbols.circle)
        };
        const statusIcon2 = statusIconMap[task2.status];
        const progressText = task2.status === "running" ? ` ${semantic.muted(`${percentage}%`)}` : "";
        stream.write(`${ansi.clearLine}${indentStr}${statusIcon2} ${task2.label}${progressText}
`);
        lines++;
      }
      yield* Ref2.set(lineCountRef, lines);
    });
    const handle = {
      addTask: (id, label, total) => Effect2.gen(function* () {
        yield* Ref2.update(tasksRef, (tasks) => {
          const newTasks = new Map(tasks);
          newTasks.set(id, { label, total, current: 0, status: "running" });
          return newTasks;
        });
        yield* render;
      }),
      updateTask: (id, current, label) => Effect2.gen(function* () {
        yield* Ref2.update(tasksRef, (tasks) => {
          const newTasks = new Map(tasks);
          const task2 = newTasks.get(id);
          if (task2) {
            newTasks.set(id, {
              ...task2,
              current,
              label: label ?? task2.label
            });
          }
          return newTasks;
        });
        yield* render;
      }),
      completeTask: (id, label) => Effect2.gen(function* () {
        yield* Ref2.update(tasksRef, (tasks) => {
          const newTasks = new Map(tasks);
          const task2 = newTasks.get(id);
          if (task2) {
            newTasks.set(id, {
              ...task2,
              current: task2.total,
              status: "complete",
              label: label ?? task2.label
            });
          }
          return newTasks;
        });
        yield* render;
      }),
      failTask: (id, label) => Effect2.gen(function* () {
        yield* Ref2.update(tasksRef, (tasks) => {
          const newTasks = new Map(tasks);
          const task2 = newTasks.get(id);
          if (task2) {
            newTasks.set(id, {
              ...task2,
              status: "failed",
              label: label ?? task2.label
            });
          }
          return newTasks;
        });
        yield* render;
      }),
      done: () => Effect2.void
    };
    return handle;
  });
}

// src/table.ts
import { Effect as Effect3 } from "effect";
var boxChars = {
  simple: {
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
    horizontal: "-",
    vertical: "|",
    teeLeft: "+",
    teeRight: "+",
    teeTop: "+",
    teeBottom: "+",
    cross: "+"
  },
  box: {
    topLeft: symbols.boxTopLeft,
    topRight: symbols.boxTopRight,
    bottomLeft: symbols.boxBottomLeft,
    bottomRight: symbols.boxBottomRight,
    horizontal: symbols.boxHorizontal,
    vertical: symbols.boxVertical,
    teeLeft: symbols.boxTeeLeft,
    teeRight: symbols.boxTeeRight,
    teeTop: symbols.boxTeeTop,
    teeBottom: symbols.boxTeeBottom,
    cross: symbols.boxCross
  },
  rounded: {
    topLeft: symbols.boxRoundTopLeft,
    topRight: symbols.boxRoundTopRight,
    bottomLeft: symbols.boxRoundBottomLeft,
    bottomRight: symbols.boxRoundBottomRight,
    horizontal: symbols.boxHorizontal,
    vertical: symbols.boxVertical,
    teeLeft: symbols.boxTeeLeft,
    teeRight: symbols.boxTeeRight,
    teeTop: symbols.boxTeeTop,
    teeBottom: symbols.boxTeeBottom,
    cross: symbols.boxCross
  },
  heavy: {
    topLeft: symbols.boxHeavyTopLeft,
    topRight: symbols.boxHeavyTopRight,
    bottomLeft: symbols.boxHeavyBottomLeft,
    bottomRight: symbols.boxHeavyBottomRight,
    horizontal: symbols.boxHeavyHorizontal,
    vertical: symbols.boxHeavyVertical,
    teeLeft: symbols.boxHeavyVertical,
    teeRight: symbols.boxHeavyVertical,
    teeTop: symbols.boxHeavyHorizontal,
    teeBottom: symbols.boxHeavyHorizontal,
    cross: symbols.boxHeavyHorizontal
  },
  double: {
    topLeft: symbols.boxDoubleTopLeft,
    topRight: symbols.boxDoubleTopRight,
    bottomLeft: symbols.boxDoubleBottomLeft,
    bottomRight: symbols.boxDoubleBottomRight,
    horizontal: symbols.boxDoubleHorizontal,
    vertical: symbols.boxDoubleVertical,
    teeLeft: symbols.boxDoubleVertical,
    teeRight: symbols.boxDoubleVertical,
    teeTop: symbols.boxDoubleHorizontal,
    teeBottom: symbols.boxDoubleHorizontal,
    cross: symbols.boxDoubleHorizontal
  },
  minimal: {
    topLeft: "",
    topRight: "",
    bottomLeft: "",
    bottomRight: "",
    horizontal: "",
    vertical: " ",
    teeLeft: "",
    teeRight: "",
    teeTop: "",
    teeBottom: "",
    cross: ""
  }
};
function getCellValue(column, row, index) {
  if (column.accessor) {
    return column.accessor(row, index);
  }
  if (column.key !== void 0) {
    const value = row[column.key];
    return value === null || value === void 0 ? "" : String(value);
  }
  return "";
}
function alignText(text, width, align) {
  switch (align) {
    case "left":
      return padEnd(text, width);
    case "center":
      return center(text, width);
    case "right":
      return padStart(text, width);
  }
}
function renderTable(config) {
  const {
    columns,
    data,
    style: style2 = "box",
    indent = 0,
    headerStyle = semantic.header,
    rowStyle,
    showHeader = true,
    showRowNumbers = false,
    maxWidth
  } = config;
  const chars = boxChars[style2];
  const indentStr = " ".repeat(indent);
  const columnWidths = columns.map((col, colIdx) => {
    if (col.width) return col.width;
    const headerLen = visibleLength(col.header);
    const maxDataLen = data.reduce((max, row, rowIdx) => {
      const cell = getCellValue(col, row, rowIdx);
      return Math.max(max, visibleLength(cell));
    }, 0);
    return Math.max(headerLen, maxDataLen);
  });
  const rowNumWidth = showRowNumbers ? String(data.length).length + 2 : 0;
  if (maxWidth) {
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0) + rowNumWidth + (columns.length + 1) * 3 + indent;
    if (totalWidth > maxWidth) {
      const overflow = totalWidth - maxWidth;
      const lastColIdx = columnWidths.length - 1;
      const lastColWidth = columnWidths[lastColIdx];
      if (lastColWidth !== void 0 && lastColWidth > overflow + 5) {
        columnWidths[lastColIdx] = lastColWidth - overflow;
      }
    }
  }
  const lines = [];
  const buildRow = (cells, isHeader = false) => {
    const parts = [];
    if (style2 !== "minimal") {
      parts.push(chars.vertical);
    }
    if (showRowNumbers) {
      parts.push(" ".repeat(rowNumWidth));
      if (style2 !== "minimal") parts.push(chars.vertical);
    }
    cells.forEach((cell, idx) => {
      const width = columnWidths[idx];
      const col = columns[idx];
      const align = isHeader ? col.headerAlign ?? col.align ?? "left" : col.align ?? "left";
      const aligned = alignText(cell, width, align);
      parts.push(` ${aligned} `);
      if (style2 !== "minimal") parts.push(chars.vertical);
    });
    return indentStr + parts.join("");
  };
  const buildSeparator = (left, mid, right, line) => {
    if (style2 === "minimal") return "";
    const parts = [left];
    if (showRowNumbers) {
      parts.push(line.repeat(rowNumWidth + 2));
      parts.push(mid);
    }
    columnWidths.forEach((width, idx) => {
      parts.push(line.repeat(width + 2));
      if (idx < columnWidths.length - 1) {
        parts.push(mid);
      }
    });
    parts.push(right);
    return indentStr + parts.join("");
  };
  if (style2 !== "minimal") {
    lines.push(
      buildSeparator(
        chars.topLeft,
        chars.teeBottom,
        chars.topRight,
        chars.horizontal
      )
    );
  }
  if (showHeader) {
    const headerCells = columns.map((col) => headerStyle(col.header));
    lines.push(buildRow(headerCells, true));
    if (style2 !== "minimal") {
      lines.push(
        buildSeparator(
          chars.teeRight,
          chars.cross,
          chars.teeLeft,
          chars.horizontal
        )
      );
    }
  }
  data.forEach((row, rowIdx) => {
    const cells = columns.map((col, colIdx) => {
      let cell = getCellValue(col, row, rowIdx);
      if (rowStyle) {
        cell = rowStyle(cell, row, rowIdx);
      }
      return cell;
    });
    lines.push(buildRow(cells));
  });
  if (style2 !== "minimal") {
    lines.push(
      buildSeparator(
        chars.bottomLeft,
        chars.teeTop,
        chars.bottomRight,
        chars.horizontal
      )
    );
  }
  return lines;
}
function printTable(config) {
  return Effect3.sync(() => {
    const lines = renderTable(config);
    for (const line of lines) {
      console.log(line);
    }
  });
}
function quickTable(data, options) {
  if (data.length === 0) return Effect3.void;
  const keys = options?.columns ?? Object.keys(data[0]);
  const columns = keys.map((key) => ({
    header: String(key),
    key,
    align: "left"
  }));
  return printTable({
    columns,
    data,
    style: options?.style ?? "box",
    indent: options?.indent ?? 0
  });
}
function keyValueTable(pairs, options) {
  return Effect3.sync(() => {
    const {
      indent = 2,
      keyStyle = semantic.label,
      valueStyle = semantic.value,
      separator = ": "
    } = options ?? {};
    const indentStr = " ".repeat(indent);
    const maxKeyLen = Math.max(...pairs.map(([k]) => visibleLength(k)));
    for (const [key, value] of pairs) {
      const paddedKey = padEnd(key, maxKeyLen);
      console.log(
        `${indentStr}${keyStyle(paddedKey)}${separator}${valueStyle(value)}`
      );
    }
  });
}
function statusTable(items, options) {
  return Effect3.sync(() => {
    const { indent = 2 } = options ?? {};
    const indentStr = " ".repeat(indent);
    const statusIcons = {
      success: semantic.success(symbols.success),
      error: semantic.error(symbols.error),
      warning: semantic.warning(symbols.warning),
      pending: semantic.muted(symbols.circle),
      running: semantic.primary(symbols.circleDotted)
    };
    const maxNameLen = Math.max(...items.map((i) => visibleLength(i.name)));
    for (const item of items) {
      const icon = statusIcons[item.status];
      const name = padEnd(item.name, maxNameLen);
      const msg = item.message ? ` ${semantic.muted(item.message)}` : "";
      console.log(`${indentStr}${icon} ${name}${msg}`);
    }
  });
}

// src/box.ts
import { Effect as Effect4 } from "effect";
var boxChars2 = {
  single: {
    topLeft: symbols.boxTopLeft,
    topRight: symbols.boxTopRight,
    bottomLeft: symbols.boxBottomLeft,
    bottomRight: symbols.boxBottomRight,
    horizontal: symbols.boxHorizontal,
    vertical: symbols.boxVertical
  },
  double: {
    topLeft: symbols.boxDoubleTopLeft,
    topRight: symbols.boxDoubleTopRight,
    bottomLeft: symbols.boxDoubleBottomLeft,
    bottomRight: symbols.boxDoubleBottomRight,
    horizontal: symbols.boxDoubleHorizontal,
    vertical: symbols.boxDoubleVertical
  },
  rounded: {
    topLeft: symbols.boxRoundTopLeft,
    topRight: symbols.boxRoundTopRight,
    bottomLeft: symbols.boxRoundBottomLeft,
    bottomRight: symbols.boxRoundBottomRight,
    horizontal: symbols.boxHorizontal,
    vertical: symbols.boxVertical
  },
  heavy: {
    topLeft: symbols.boxHeavyTopLeft,
    topRight: symbols.boxHeavyTopRight,
    bottomLeft: symbols.boxHeavyBottomLeft,
    bottomRight: symbols.boxHeavyBottomRight,
    horizontal: symbols.boxHeavyHorizontal,
    vertical: symbols.boxHeavyVertical
  },
  none: {
    topLeft: " ",
    topRight: " ",
    bottomLeft: " ",
    bottomRight: " ",
    horizontal: " ",
    vertical: " "
  }
};
function renderBox(content, config = {}) {
  const {
    title,
    style: style2 = "single",
    padding = 1,
    margin = 0,
    width: fixedWidth,
    align = "left",
    titleAlign = "left",
    borderColor = (t) => t,
    titleColor = semantic.header
  } = config;
  const chars = boxChars2[style2];
  const lines = Array.isArray(content) ? content : content.split("\n");
  const contentWidth = Math.max(
    ...lines.map((l) => visibleLength(l)),
    title ? visibleLength(title) + 2 : 0
  );
  const innerWidth = fixedWidth ? fixedWidth - 2 - padding * 2 : contentWidth;
  const totalWidth = innerWidth + 2 + padding * 2;
  const marginStr = " ".repeat(margin);
  const paddingStr = " ".repeat(padding);
  const output = [];
  const topLine = chars.horizontal.repeat(totalWidth - 2);
  if (title) {
    const titleText = ` ${titleColor(title)} `;
    const titleLen = visibleLength(titleText);
    const remaining = totalWidth - 2 - titleLen;
    let titleLine;
    switch (titleAlign) {
      case "center": {
        const left = Math.floor(remaining / 2);
        const right = remaining - left;
        titleLine = chars.horizontal.repeat(left) + titleText + chars.horizontal.repeat(right);
        break;
      }
      case "right": {
        titleLine = chars.horizontal.repeat(remaining) + titleText;
        break;
      }
      default: {
        titleLine = titleText + chars.horizontal.repeat(remaining);
        break;
      }
    }
    output.push(
      marginStr + borderColor(chars.topLeft) + titleLine + borderColor(chars.topRight)
    );
  } else {
    output.push(
      marginStr + borderColor(chars.topLeft + topLine + chars.topRight)
    );
  }
  for (let i = 0; i < padding; i++) {
    output.push(
      marginStr + borderColor(chars.vertical) + " ".repeat(totalWidth - 2) + borderColor(chars.vertical)
    );
  }
  for (const line of lines) {
    let paddedContent;
    const lineLen = visibleLength(line);
    switch (align) {
      case "center":
        paddedContent = center(line, innerWidth);
        break;
      case "right":
        paddedContent = " ".repeat(innerWidth - lineLen) + line;
        break;
      default:
        paddedContent = line + " ".repeat(innerWidth - lineLen);
        break;
    }
    output.push(
      marginStr + borderColor(chars.vertical) + paddingStr + paddedContent + paddingStr + borderColor(chars.vertical)
    );
  }
  for (let i = 0; i < padding; i++) {
    output.push(
      marginStr + borderColor(chars.vertical) + " ".repeat(totalWidth - 2) + borderColor(chars.vertical)
    );
  }
  const bottomLine = chars.horizontal.repeat(totalWidth - 2);
  output.push(
    marginStr + borderColor(chars.bottomLeft + bottomLine + chars.bottomRight)
  );
  return output;
}
function printBox(content, config) {
  return Effect4.sync(() => {
    const lines = renderBox(content, config);
    for (const line of lines) {
      console.log(line);
    }
  });
}
function banner(text, config) {
  return printBox(text, {
    ...config,
    style: "double",
    padding: 1,
    align: "center",
    titleAlign: "center"
  });
}
function sectionHeader(text, options) {
  return Effect4.sync(() => {
    const { width = 60, char = symbols.boxHorizontal } = options ?? {};
    const textLen = visibleLength(text);
    const padding = Math.max(0, Math.floor((width - textLen - 4) / 2));
    const line = char.repeat(padding);
    console.log(`
${line}  ${semantic.header(text)}  ${line}
`);
  });
}
function divider(options) {
  return Effect4.sync(() => {
    const {
      width = 60,
      char = symbols.boxHorizontal,
      style: colorStyle = semantic.muted
    } = options ?? {};
    console.log(colorStyle(char.repeat(width)));
  });
}
function infoBox(content, config) {
  return printBox(content, {
    ...config,
    borderColor: semantic.info,
    title: config?.title ?? "Info",
    titleColor: semantic.info
  });
}
function warningBox(content, config) {
  return printBox(content, {
    ...config,
    borderColor: semantic.warning,
    title: config?.title ?? "Warning",
    titleColor: semantic.warning
  });
}
function errorBox(content, config) {
  return printBox(content, {
    ...config,
    borderColor: semantic.error,
    title: config?.title ?? "Error",
    titleColor: semantic.error
  });
}
function successBox(content, config) {
  return printBox(content, {
    ...config,
    borderColor: semantic.success,
    title: config?.title ?? "Success",
    titleColor: semantic.success
  });
}

// src/prompts.ts
import { Effect as Effect5 } from "effect";
import * as readline from "readline";
function isInteractive2() {
  return process.stdin.isTTY === true;
}
function confirm(message, options) {
  if (!isInteractive2()) {
    return Effect5.succeed(options?.defaultValue ?? false);
  }
  return Effect5.async((resume) => {
    const defaultValue = options?.defaultValue ?? true;
    const hint = defaultValue ? "[Y/n]" : "[y/N]";
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr
    });
    process.stderr.write(
      `  ${semantic.primary(symbols.question)} ${message} ${semantic.muted(hint)} `
    );
    rl.once("line", (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "") {
        resume(Effect5.succeed(defaultValue));
      } else if (trimmed === "y" || trimmed === "yes") {
        resume(Effect5.succeed(true));
      } else {
        resume(Effect5.succeed(false));
      }
    });
    rl.once("close", () => {
      resume(Effect5.succeed(defaultValue));
    });
  });
}
function input(message, options) {
  if (!isInteractive2()) {
    return Effect5.succeed(options?.defaultValue ?? "");
  }
  return Effect5.async((resume) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr
    });
    const hint = options?.placeholder ? ` ${semantic.muted(`(${options.placeholder})`)}` : options?.defaultValue ? ` ${semantic.muted(`[${options.defaultValue}]`)}` : "";
    process.stderr.write(
      `  ${semantic.primary(symbols.pointer)} ${message}${hint}: `
    );
    rl.once("line", (answer) => {
      rl.close();
      const value = answer.trim() || options?.defaultValue || "";
      if (options?.validate) {
        const error = options.validate(value);
        if (error) {
          process.stderr.write(`  ${semantic.error(symbols.error)} ${error}
`);
          resume(input(message, options));
          return;
        }
      }
      resume(Effect5.succeed(value));
    });
    rl.once("close", () => {
      resume(Effect5.succeed(options?.defaultValue ?? ""));
    });
  });
}
function password(message, options) {
  if (!isInteractive2()) {
    return Effect5.succeed("");
  }
  return Effect5.async((resume) => {
    const mask = options?.mask ?? "*";
    let value = "";
    process.stderr.write(
      `  ${semantic.primary(symbols.lock)} ${message}: `
    );
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (char) => {
      const charCode = char.charCodeAt(0);
      if (charCode === 13 || charCode === 10) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stderr.write("\n");
        if (options?.validate) {
          const error = options.validate(value);
          if (error) {
            process.stderr.write(`  ${semantic.error(symbols.error)} ${error}
`);
            value = "";
            resume(password(message, options));
            return;
          }
        }
        resume(Effect5.succeed(value));
      } else if (charCode === 3) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stderr.write("\n");
        process.exit(130);
      } else if (charCode === 127) {
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
function select(message, options, config) {
  if (!isInteractive2()) {
    const defaultIdx = config?.defaultIndex ?? 0;
    return Effect5.succeed(options[defaultIdx].value);
  }
  return Effect5.async((resume) => {
    let selectedIndex = config?.defaultIndex ?? 0;
    const render = () => {
      if (selectedIndex >= 0) {
        process.stderr.write(ansi.cursorUp(options.length));
      }
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const isSelected = i === selectedIndex;
        const pointer = isSelected ? semantic.primary(symbols.pointer) : " ";
        const label = isSelected ? semantic.primary(opt.label) : opt.label;
        const hint = opt.hint ? ` ${semantic.muted(opt.hint)}` : "";
        process.stderr.write(`${ansi.clearLine}  ${pointer} ${label}${hint}
`);
      }
    };
    process.stderr.write(`  ${semantic.info(symbols.question)} ${message}
`);
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const isSelected = i === selectedIndex;
      const pointer = isSelected ? semantic.primary(symbols.pointer) : " ";
      const label = isSelected ? semantic.primary(opt.label) : opt.label;
      const hint = opt.hint ? ` ${semantic.muted(opt.hint)}` : "";
      process.stderr.write(`  ${pointer} ${label}${hint}
`);
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (key) => {
      const code = key.charCodeAt(0);
      if (key === "\x1B[A") {
        selectedIndex = Math.max(0, selectedIndex - 1);
        render();
      } else if (key === "\x1B[B") {
        selectedIndex = Math.min(options.length - 1, selectedIndex + 1);
        render();
      } else if (code === 13 || code === 10) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        resume(Effect5.succeed(options[selectedIndex].value));
      } else if (code === 3) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stderr.write("\n");
        process.exit(130);
      } else if (code === 27) {
      }
    };
    process.stdin.on("data", onData);
  });
}
function multiSelect(message, options, config) {
  if (!isInteractive2()) {
    const defaultSelected = config?.defaultSelected ?? [];
    return Effect5.succeed(
      defaultSelected.map((i) => options[i].value)
    );
  }
  return Effect5.async((resume) => {
    let cursorIndex = 0;
    const selected = new Set(config?.defaultSelected ?? []);
    const render = () => {
      process.stderr.write(ansi.cursorUp(options.length));
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const isAtCursor = i === cursorIndex;
        const isSelected = selected.has(i);
        const checkbox = isSelected ? semantic.success(symbols.checkboxOn) : semantic.muted(symbols.checkboxOff);
        const label = isAtCursor ? semantic.primary(opt.label) : opt.label;
        const hint = opt.hint ? ` ${semantic.muted(opt.hint)}` : "";
        process.stderr.write(`${ansi.clearLine}  ${checkbox} ${label}${hint}
`);
      }
    };
    process.stderr.write(
      `  ${semantic.info(symbols.question)} ${message} ${semantic.muted("(space to toggle, enter to confirm)")}
`
    );
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const isAtCursor = i === cursorIndex;
      const isSelected = selected.has(i);
      const checkbox = isSelected ? semantic.success(symbols.checkboxOn) : semantic.muted(symbols.checkboxOff);
      const label = isAtCursor ? semantic.primary(opt.label) : opt.label;
      const hint = opt.hint ? ` ${semantic.muted(opt.hint)}` : "";
      process.stderr.write(`  ${checkbox} ${label}${hint}
`);
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (key) => {
      const code = key.charCodeAt(0);
      if (key === "\x1B[A") {
        cursorIndex = Math.max(0, cursorIndex - 1);
        render();
      } else if (key === "\x1B[B") {
        cursorIndex = Math.min(options.length - 1, cursorIndex + 1);
        render();
      } else if (code === 32) {
        if (selected.has(cursorIndex)) {
          selected.delete(cursorIndex);
        } else {
          if (!config?.max || selected.size < config.max) {
            selected.add(cursorIndex);
          }
        }
        render();
      } else if (code === 13 || code === 10) {
        if (config?.required && selected.size === 0) {
          return;
        }
        if (config?.min && selected.size < config.min) {
          return;
        }
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        const result = Array.from(selected).sort((a, b) => a - b).map((i) => options[i].value);
        resume(Effect5.succeed(result));
      } else if (code === 3) {
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
function nonInteractiveConfirm(message, defaultValue) {
  return Effect5.sync(() => {
    const value = defaultValue ? "yes" : "no";
    console.log(`  ${symbols.info} ${message}: ${value} (non-interactive)`);
    return defaultValue;
  });
}
function autoConfirm(message, options) {
  if (isInteractive2()) {
    return confirm(message, options);
  }
  return nonInteractiveConfirm(message, options?.defaultValue ?? false);
}

// src/tasks.ts
import { Effect as Effect6, Ref as Ref3 } from "effect";
var statusIcon = {
  pending: semantic.muted(symbols.circle),
  running: semantic.primary(symbols.circleDotted),
  success: semantic.success(symbols.success),
  failed: semantic.error(symbols.error),
  skipped: semantic.muted(symbols.middleDot),
  warning: semantic.warning(symbols.warning)
};
function runTasks(tasks, config = {}) {
  const {
    stopOnError = true,
    showDuration = true,
    indent = 2,
    stream = process.stderr
  } = config;
  return Effect6.gen(function* () {
    const indentStr = " ".repeat(indent);
    const tasksStateRef = yield* Ref3.make(
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: "pending"
      }))
    );
    const renderedLinesRef = yield* Ref3.make(0);
    const render = Effect6.gen(function* () {
      const tasksState = yield* Ref3.get(tasksStateRef);
      const renderedLines = yield* Ref3.get(renderedLinesRef);
      if (renderedLines > 0) {
        stream.write(ansi.cursorUp(renderedLines));
      }
      for (const task2 of tasksState) {
        const icon = statusIcon[task2.status];
        const titleStyle = {
          running: semantic.primary,
          failed: semantic.error,
          skipped: semantic.muted,
          pending: (t) => t,
          success: (t) => t,
          warning: (t) => t
        };
        const title = titleStyle[task2.status](task2.title);
        const duration = showDuration && task2.duration ? ` ${semantic.muted(`(${task2.duration}ms)`)}` : "";
        const message = task2.message ? ` ${semantic.muted(task2.message)}` : "";
        stream.write(`${ansi.clearLine}${indentStr}${icon} ${title}${duration}${message}
`);
      }
      yield* Ref3.set(renderedLinesRef, tasksState.length);
    });
    const updateTask = (id, update) => Effect6.gen(function* () {
      yield* Ref3.update(
        tasksStateRef,
        (states) => states.map(
          (s) => s.id === id ? { ...s, ...update } : s
        )
      );
      yield* render;
    });
    const results = [];
    let hasError = false;
    yield* render;
    for (const task2 of tasks) {
      if (hasError && stopOnError) {
        yield* updateTask(task2.id, {
          status: "skipped",
          message: "skipped due to previous error"
        });
        results.push({
          id: task2.id,
          title: task2.title,
          status: "skipped",
          duration: 0
        });
        continue;
      }
      if (task2.skip) {
        const shouldSkip = yield* task2.skip;
        if (shouldSkip) {
          yield* updateTask(task2.id, {
            status: "skipped",
            message: task2.skipMessage ?? "skipped"
          });
          results.push({
            id: task2.id,
            title: task2.title,
            status: "skipped",
            duration: 0
          });
          continue;
        }
      }
      yield* updateTask(task2.id, { status: "running" });
      const startTime = Date.now();
      const result = yield* task2.run.pipe(
        Effect6.map((value) => ({
          success: true,
          value,
          duration: Date.now() - startTime
        })),
        Effect6.catchAll(
          (error) => Effect6.succeed({
            success: false,
            error,
            duration: Date.now() - startTime
          })
        )
      );
      if (result.success) {
        yield* updateTask(task2.id, {
          status: "success",
          duration: result.duration
        });
        results.push({
          id: task2.id,
          title: task2.title,
          status: "success",
          result: result.value,
          duration: result.duration
        });
      } else {
        hasError = true;
        yield* updateTask(task2.id, {
          status: "failed",
          duration: result.duration,
          message: String(result.error)
        });
        results.push({
          id: task2.id,
          title: task2.title,
          status: "failed",
          error: result.error,
          duration: result.duration
        });
        if (stopOnError) {
          return yield* Effect6.fail(result.error);
        }
      }
    }
    return results;
  });
}
function task(id, title, run, options) {
  return {
    id,
    title,
    run,
    skip: options?.skip,
    skipMessage: options?.skipMessage
  };
}
var log = {
  title: (text, options) => Effect6.sync(() => {
    const indent = " ".repeat(options?.indent ?? 0);
    console.log(`
${indent}${semantic.header(text)}`);
  }),
  step: (text, options) => Effect6.sync(() => {
    const indent = " ".repeat(options?.indent ?? 2);
    console.log(`${indent}${semantic.primary(symbols.arrowRight)} ${text}`);
  }),
  success: (text, options) => Effect6.sync(() => {
    const indent = " ".repeat(options?.indent ?? 2);
    console.log(`${indent}${semantic.success(symbols.success)} ${text}`);
  }),
  error: (text, options) => Effect6.sync(() => {
    const indent = " ".repeat(options?.indent ?? 2);
    console.log(`${indent}${semantic.error(symbols.error)} ${text}`);
  }),
  warning: (text, options) => Effect6.sync(() => {
    const indent = " ".repeat(options?.indent ?? 2);
    console.log(`${indent}${semantic.warning(symbols.warning)} ${text}`);
  }),
  info: (text, options) => Effect6.sync(() => {
    const indent = " ".repeat(options?.indent ?? 2);
    console.log(`${indent}${semantic.info(symbols.info)} ${text}`);
  }),
  muted: (text, options) => Effect6.sync(() => {
    const indent = " ".repeat(options?.indent ?? 2);
    console.log(`${indent}${semantic.muted(text)}`);
  }),
  newline: () => Effect6.sync(() => {
    console.log("");
  }),
  divider: (options) => Effect6.sync(() => {
    const width = options?.width ?? 50;
    const char = options?.char ?? symbols.boxHorizontal;
    const indent = " ".repeat(options?.indent ?? 0);
    console.log(`${indent}${semantic.muted(char.repeat(width))}`);
  })
};
function printTaskSummary(results, options) {
  return Effect6.sync(() => {
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
        `${indent}  ${semantic.error(symbols.error)} ${failed} failed`
      );
    }
    if (success > 0) {
      console.log(
        `${indent}  ${semantic.success(symbols.success)} ${success} succeeded`
      );
    }
    if (skipped > 0) {
      console.log(
        `${indent}  ${semantic.muted(symbols.middleDot)} ${skipped} skipped`
      );
    }
    console.log(
      `${indent}  ${semantic.muted(`Total: ${total} tasks in ${totalDuration}ms`)}`
    );
    console.log("");
  });
}
function withStepLog(stepName, effect, options) {
  return Effect6.gen(function* () {
    yield* log.step(stepName, { indent: options?.indent });
    const result = yield* effect.pipe(
      Effect6.tapError(
        () => log.error(options?.errorMessage ?? `Failed: ${stepName}`, {
          indent: options?.indent
        })
      ),
      Effect6.tap(
        () => log.success(options?.successMessage ?? stepName, {
          indent: options?.indent
        })
      )
    );
    return result;
  });
}
export {
  ansi,
  autoConfirm,
  banner,
  bgColor256,
  bgRgb,
  center,
  color,
  color256,
  confirm,
  createMultiProgress,
  createProgress,
  createSpinner,
  createStyle,
  divider,
  errorBox,
  infoBox,
  input,
  isInteractive2 as isInteractive,
  isInteractive as isSpinnerInteractive,
  keyValueTable,
  log,
  multiSelect,
  nonInteractiveConfirm,
  padEnd,
  padStart,
  password,
  printBox,
  printTable,
  printTaskSummary,
  progressIndicator,
  quickTable,
  renderBox,
  renderTable,
  rgb,
  runTasks,
  sectionHeader,
  select,
  semantic,
  spinnerFrames,
  staticSpinner,
  statusTable,
  stripAnsi,
  style,
  styled,
  successBox,
  symbols,
  task,
  truncate,
  visibleLength,
  warningBox,
  withProgress,
  withSpinner,
  withSpinnerAuto,
  withSpinnerTasks,
  withStepLog
};
//# sourceMappingURL=index.js.map