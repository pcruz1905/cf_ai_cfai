#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";
import { readFileSync as readFileSync2 } from "fs";

// src/auth.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";
var CONFIG_DIR = join(homedir(), ".cfai");
var CONFIG_FILE = join(CONFIG_DIR, "config.json");
function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}
function loadConfig() {
  ensureConfigDir();
  if (existsSync(CONFIG_FILE)) {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  }
  const config = {
    token: randomUUID(),
    apiUrl: "http://localhost:8787"
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}
function updateConfig(updates) {
  const config = { ...loadConfig(), ...updates };
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

// src/client.ts
function headers() {
  const config = loadConfig();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.token}`
  };
}
function apiUrl(path) {
  const config = loadConfig();
  return `${config.apiUrl}${path}`;
}
async function safeFetch(url, init) {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(
        response.status === 401 ? "Unauthorized \u2014 check your token with: cfai whoami" : `API error (${response.status}): ${text}`
      );
    }
    return response;
  } catch (err) {
    if (err instanceof TypeError && err.cause) {
      throw new Error(
        `Cannot connect to API at ${url} \u2014 is the worker running?
  Start it with: pnpm dev`
      );
    }
    throw err;
  }
}
async function askStream(payload, onToken) {
  const response = await safeFetch(apiUrl("/api/ask"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload)
  });
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        if (parsed.response) onToken(parsed.response);
      } catch {
      }
    }
  }
}
async function configSet(key, value) {
  await safeFetch(apiUrl("/api/config"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ key, value })
  });
}
async function configGet() {
  const response = await safeFetch(apiUrl("/api/config"), {
    method: "GET",
    headers: headers()
  });
  return await response.json();
}
async function getHistory() {
  const response = await safeFetch(apiUrl("/api/history"), {
    method: "GET",
    headers: headers()
  });
  return await response.json();
}
async function clearSession() {
  await safeFetch(apiUrl("/api/clear"), {
    method: "DELETE",
    headers: headers()
  });
}

// ../cli-tui/dist/index.js
import { Effect, Fiber, Ref, Schedule } from "effect";
import { Effect as Effect2, Ref as Ref2 } from "effect";
import { Effect as Effect3 } from "effect";
import { Effect as Effect4 } from "effect";
import { Effect as Effect5 } from "effect";
import { Effect as Effect6, Ref as Ref3 } from "effect";
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
var defaultConfig = {
  type: "dots",
  text: "",
  interval: 80,
  stream: process.stderr,
  indent: 2
};
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
var statusIcon = {
  pending: semantic.muted(symbols.circle),
  running: semantic.primary(symbols.circleDotted),
  success: semantic.success(symbols.success),
  failed: semantic.error(symbols.error),
  skipped: semantic.muted(symbols.middleDot),
  warning: semantic.warning(symbols.warning)
};

// src/ui.ts
function startSpinner(text) {
  const frames = spinnerFrames.dots;
  const len = frames.length;
  let i = 0;
  const id = setInterval(() => {
    process.stderr.write(
      `\r${ansi.clearLine}  ${semantic.primary(frames[i++ % len])} ${text}`
    );
  }, 80);
  return {
    stop() {
      clearInterval(id);
      process.stderr.write(`\r${ansi.clearLine}`);
    },
    succeed(msg) {
      clearInterval(id);
      process.stderr.write(
        `\r${ansi.clearLine}  ${semantic.success(symbols.success)} ${msg ?? text}
`
      );
    },
    fail(msg) {
      clearInterval(id);
      process.stderr.write(
        `\r${ansi.clearLine}  ${semantic.error(symbols.error)} ${msg ?? text}
`
      );
    }
  };
}
function info(msg) {
  console.log(`  ${semantic.info(symbols.info)} ${msg}`);
}
function success(msg) {
  console.log(`  ${semantic.success(symbols.success)} ${msg}`);
}
function fail(msg) {
  console.error(`  ${semantic.error(symbols.error)} ${msg}`);
}
function header(title) {
  console.log(`
  ${semantic.header(title)}`);
}
function muted(msg) {
  console.log(`  ${semantic.muted(msg)}`);
}
function printHistory(messages) {
  if (messages.length === 0) {
    muted('No history yet. Start a conversation with: cfai ask "hello"');
    return;
  }
  header(`Chat History (${messages.length} messages)`);
  console.log();
  for (const msg of messages) {
    const isUser = msg.role === "user";
    const icon = isUser ? symbols.arrowRight : symbols.arrowLeft;
    const label = isUser ? "You" : "AI";
    const labelColor = isUser ? semantic.highlight : semantic.primary;
    const contentPreview = msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content;
    console.log(`  ${labelColor(`${icon} ${label}`)}`);
    for (const line of contentPreview.split("\n")) {
      console.log(`    ${line}`);
    }
    console.log();
  }
}
function printProfile(profile) {
  const entries = Object.entries(profile);
  if (entries.length === 0) {
    muted("No profile set yet.");
    info(`Set your stack: ${semantic.code('cfai config set stack "TypeScript, Cloudflare Workers"')}`);
    return;
  }
  const data = entries.map(([key, value]) => ({ key, value }));
  const columns = [
    { header: "Key", key: "key", align: "left" },
    { header: "Value", key: "value", align: "left" }
  ];
  header("Your Profile");
  console.log();
  const lines = renderTable({ columns, data, style: "rounded", indent: 2 });
  for (const line of lines) {
    console.log(line);
  }
}
function printWhoami(token, apiUrl2) {
  const lines = renderBox(
    [
      `${semantic.muted("Token:")}  ${token}`,
      `${semantic.muted("API:")}    ${apiUrl2}`
    ],
    {
      title: "cfai",
      style: "rounded",
      padding: 1,
      margin: 1,
      borderColor: semantic.muted,
      titleColor: semantic.highlight
    }
  );
  for (const line of lines) {
    console.log(line);
  }
}
function startStreamingResponse() {
  console.log();
  process.stdout.write(`  ${semantic.muted(symbols.boxVertical)} `);
  let currentLineLength = 0;
  return {
    write(token) {
      const parts = token.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          process.stdout.write(`
  ${semantic.muted(symbols.boxVertical)} `);
          currentLineLength = 0;
        }
        process.stdout.write(parts[i]);
        currentLineLength += parts[i].length;
      }
    },
    end() {
      process.stdout.write("\n\n");
    }
  };
}

// src/index.ts
var program = new Command();
program.name("cfai").description("CLI AI assistant powered by Llama 3.3 on Cloudflare Workers AI").version("0.1.0");
program.command("ask").description("Ask a question").argument("<question...>", "Your question").option("-f, --file <path>", "Attach a file for context").action(async (questionParts, opts) => {
  const message = questionParts.join(" ");
  let fileContent;
  if (opts.file) {
    try {
      fileContent = readFileSync2(opts.file, "utf-8");
      info(`Attached ${semantic.code(opts.file)}`);
    } catch {
      fail(`Could not read file: ${opts.file}`);
      process.exit(1);
    }
  }
  const spinner = startSpinner("Thinking...");
  let firstToken = true;
  let response;
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
program.command("fix").description("Pipe output and get a fix suggestion").action(async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString("utf-8").trim();
  if (!input) {
    fail("No input received. Pipe something into cfai fix.");
    info("Example: cat error.log | cfai fix");
    process.exit(1);
  }
  const message = `Fix this error or issue:

\`\`\`
${input}
\`\`\``;
  const spinner = startSpinner("Analyzing...");
  let firstToken = true;
  let response;
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
var configCmd = program.command("config").description("Manage your profile configuration");
configCmd.command("set").description("Set a profile key").argument("<key>", "Profile key (e.g. stack, os, editor)").argument("<value...>", "Profile value").action(async (key, valueParts) => {
  const value = valueParts.join(" ");
  try {
    await configSet(key, value);
    success(`${key} ${semantic.muted("=")} ${value}`);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
});
configCmd.command("get").description("Show your profile").action(async () => {
  try {
    const profile = await configGet();
    printProfile(profile);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
});
configCmd.command("api-url").description("Set the API URL").argument("<url>", "Worker API URL").action((url) => {
  updateConfig({ apiUrl: url });
  success(`API URL set to ${semantic.code(url)}`);
});
program.command("history").description("Show chat history").action(async () => {
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
program.command("clear").description("Clear all memory (history + profile)").action(async () => {
  const spinner = startSpinner("Clearing session...");
  try {
    await clearSession();
    spinner.succeed("Session cleared \u2014 history and profile wiped");
  } catch (err) {
    spinner.fail("Failed to clear session");
    fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
});
program.command("whoami").description("Show your token and API URL").action(() => {
  const config = loadConfig();
  printWhoami(config.token, config.apiUrl);
});
program.parse();
//# sourceMappingURL=index.js.map