/**
 * ANSI color codes and styling utilities for terminal output.
 */

export const ansi = {
  // Reset
  reset: "\x1b[0m",

  // Styles
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  blink: "\x1b[5m",
  inverse: "\x1b[7m",
  hidden: "\x1b[8m",
  strikethrough: "\x1b[9m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Bright foreground colors
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",

  // Cursor control
  cursorUp: (n = 1) => `\x1b[${n}A`,
  cursorDown: (n = 1) => `\x1b[${n}B`,
  cursorForward: (n = 1) => `\x1b[${n}C`,
  cursorBack: (n = 1) => `\x1b[${n}D`,
  cursorTo: (x: number, y?: number) =>
    y === undefined ? `\x1b[${x}G` : `\x1b[${y};${x}H`,
  cursorSave: "\x1b[s",
  cursorRestore: "\x1b[u",
  cursorHide: "\x1b[?25l",
  cursorShow: "\x1b[?25h",

  // Line control
  clearLine: "\x1b[2K",
  clearLineEnd: "\x1b[0K",
  clearLineStart: "\x1b[1K",
  clearScreen: "\x1b[2J",
  clearScreenDown: "\x1b[0J",
  clearScreenUp: "\x1b[1J",
} as const;

export type ColorName =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray"
  | "brightRed"
  | "brightGreen"
  | "brightYellow"
  | "brightBlue"
  | "brightMagenta"
  | "brightCyan"
  | "brightWhite";

export type StyleName =
  | "bold"
  | "dim"
  | "italic"
  | "underline"
  | "inverse"
  | "strikethrough";

/**
 * Apply a color to text.
 */
export function color(text: string, colorName: ColorName): string {
  return `${ansi[colorName]}${text}${ansi.reset}`;
}

/**
 * Apply a style to text.
 */
export function style(text: string, styleName: StyleName): string {
  return `${ansi[styleName]}${text}${ansi.reset}`;
}

/**
 * Apply multiple styles/colors to text.
 */
export function styled(
  text: string,
  ...styles: Array<ColorName | StyleName>
): string {
  const codes = styles.map((s) => ansi[s]).join("");
  return `${codes}${text}${ansi.reset}`;
}

/**
 * Create a reusable styled function.
 */
export function createStyle(
  ...styles: Array<ColorName | StyleName>
): (text: string) => string {
  const codes = styles.map((s) => ansi[s]).join("");
  return (text: string) => `${codes}${text}${ansi.reset}`;
}

// Pre-built semantic styles
export const semantic = {
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
  value: createStyle("white"),
} as const;

/**
 * Strip ANSI codes from a string.
 */
export function stripAnsi(text: string): string {
  // Match ESC [ followed by params and command letter
  const ansiPattern = new RegExp("\x1b\\[[0-9;]*[a-zA-Z]", "g");
  return text.replace(ansiPattern, "");
}

/**
 * Get visible length of a string (excluding ANSI codes).
 */
export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}

/**
 * Pad a string to a specific visible width (accounting for ANSI codes).
 */
export function padEnd(text: string, width: number, char = " "): string {
  const visible = visibleLength(text);
  if (visible >= width) return text;
  return text + char.repeat(width - visible);
}

export function padStart(text: string, width: number, char = " "): string {
  const visible = visibleLength(text);
  if (visible >= width) return text;
  return char.repeat(width - visible) + text;
}

export function center(text: string, width: number, char = " "): string {
  const visible = visibleLength(text);
  if (visible >= width) return text;
  const left = Math.floor((width - visible) / 2);
  const right = width - visible - left;
  return char.repeat(left) + text + char.repeat(right);
}

/**
 * Truncate text to a maximum visible width.
 */
export function truncate(
  text: string,
  maxWidth: number,
  suffix = "...",
): string {
  if (visibleLength(text) <= maxWidth) return text;
  const stripped = stripAnsi(text);
  const truncated = stripped.slice(0, maxWidth - suffix.length);
  return truncated + suffix;
}

/**
 * RGB color support (256-color terminals).
 */
export function rgb(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function bgRgb(r: number, g: number, b: number): string {
  return `\x1b[48;2;${r};${g};${b}m`;
}

/**
 * 256-color support.
 */
export function color256(n: number): string {
  return `\x1b[38;5;${n}m`;
}

export function bgColor256(n: number): string {
  return `\x1b[48;5;${n}m`;
}
