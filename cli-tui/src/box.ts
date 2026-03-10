/**
 * Box/panel drawing for terminal output.
 */

import { Effect } from "effect";
import { semantic, visibleLength, center } from "./colors";
import { symbols } from "./symbols";

export type BoxStyle = "single" | "double" | "rounded" | "heavy" | "none";

const boxChars: Record<
  BoxStyle,
  {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    horizontal: string;
    vertical: string;
  }
> = {
  single: {
    topLeft: symbols.boxTopLeft,
    topRight: symbols.boxTopRight,
    bottomLeft: symbols.boxBottomLeft,
    bottomRight: symbols.boxBottomRight,
    horizontal: symbols.boxHorizontal,
    vertical: symbols.boxVertical,
  },
  double: {
    topLeft: symbols.boxDoubleTopLeft,
    topRight: symbols.boxDoubleTopRight,
    bottomLeft: symbols.boxDoubleBottomLeft,
    bottomRight: symbols.boxDoubleBottomRight,
    horizontal: symbols.boxDoubleHorizontal,
    vertical: symbols.boxDoubleVertical,
  },
  rounded: {
    topLeft: symbols.boxRoundTopLeft,
    topRight: symbols.boxRoundTopRight,
    bottomLeft: symbols.boxRoundBottomLeft,
    bottomRight: symbols.boxRoundBottomRight,
    horizontal: symbols.boxHorizontal,
    vertical: symbols.boxVertical,
  },
  heavy: {
    topLeft: symbols.boxHeavyTopLeft,
    topRight: symbols.boxHeavyTopRight,
    bottomLeft: symbols.boxHeavyBottomLeft,
    bottomRight: symbols.boxHeavyBottomRight,
    horizontal: symbols.boxHeavyHorizontal,
    vertical: symbols.boxHeavyVertical,
  },
  none: {
    topLeft: " ",
    topRight: " ",
    bottomLeft: " ",
    bottomRight: " ",
    horizontal: " ",
    vertical: " ",
  },
};

export interface BoxConfig {
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
export function renderBox(
  content: string | readonly string[],
  config: BoxConfig = {},
): string[] {
  const {
    title,
    style = "single",
    padding = 1,
    margin = 0,
    width: fixedWidth,
    align = "left",
    titleAlign = "left",
    borderColor = (t: string) => t,
    titleColor = semantic.header,
  } = config;

  const chars = boxChars[style];
  const lines: readonly string[] = Array.isArray(content)
    ? content
    : (content as string).split("\n");

  // Calculate content width
  const contentWidth = Math.max(
    ...lines.map((l) => visibleLength(l)),
    title ? visibleLength(title) + 2 : 0,
  );
  const innerWidth = fixedWidth
    ? fixedWidth - 2 - padding * 2
    : contentWidth;
  const totalWidth = innerWidth + 2 + padding * 2;

  const marginStr = " ".repeat(margin);
  const paddingStr = " ".repeat(padding);
  const output: string[] = [];

  // Top border with optional title
  const topLine = chars.horizontal.repeat(totalWidth - 2);
  if (title) {
    const titleText = ` ${titleColor(title)} `;
    const titleLen = visibleLength(titleText);
    const remaining = totalWidth - 2 - titleLen;

    let titleLine: string;
    switch (titleAlign) {
      case "center": {
        const left = Math.floor(remaining / 2);
        const right = remaining - left;
        titleLine =
          chars.horizontal.repeat(left) +
          titleText +
          chars.horizontal.repeat(right);
        break;
      }
      case "right": {
        titleLine =
          chars.horizontal.repeat(remaining) +
          titleText;
        break;
      }
      default: {
        titleLine =
          titleText +
          chars.horizontal.repeat(remaining);
        break;
      }
    }
    output.push(
      marginStr +
        borderColor(chars.topLeft) +
        titleLine +
        borderColor(chars.topRight),
    );
  } else {
    output.push(
      marginStr +
        borderColor(chars.topLeft + topLine + chars.topRight),
    );
  }

  // Padding top
  for (let i = 0; i < padding; i++) {
    output.push(
      marginStr +
        borderColor(chars.vertical) +
        " ".repeat(totalWidth - 2) +
        borderColor(chars.vertical),
    );
  }

  // Content lines
  for (const line of lines) {
    let paddedContent: string;
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
      marginStr +
        borderColor(chars.vertical) +
        paddingStr +
        paddedContent +
        paddingStr +
        borderColor(chars.vertical),
    );
  }

  // Padding bottom
  for (let i = 0; i < padding; i++) {
    output.push(
      marginStr +
        borderColor(chars.vertical) +
        " ".repeat(totalWidth - 2) +
        borderColor(chars.vertical),
    );
  }

  // Bottom border
  const bottomLine = chars.horizontal.repeat(totalWidth - 2);
  output.push(
    marginStr +
      borderColor(chars.bottomLeft + bottomLine + chars.bottomRight),
  );

  return output;
}

/**
 * Print a boxed message to the console.
 */
export function printBox(
  content: string | readonly string[],
  config?: BoxConfig,
): Effect.Effect<void> {
  return Effect.sync(() => {
    const lines = renderBox(content, config);
    for (const line of lines) {
      console.log(line);
    }
  });
}

/**
 * Print a header banner.
 */
export function banner(
  text: string,
  config?: Omit<BoxConfig, "style" | "padding">,
): Effect.Effect<void> {
  return printBox(text, {
    ...config,
    style: "double",
    padding: 1,
    align: "center",
    titleAlign: "center",
  });
}

/**
 * Print a section header.
 */
export function sectionHeader(
  text: string,
  options?: { width?: number; char?: string },
): Effect.Effect<void> {
  return Effect.sync(() => {
    const { width = 60, char = symbols.boxHorizontal } = options ?? {};
    const textLen = visibleLength(text);
    const padding = Math.max(0, Math.floor((width - textLen - 4) / 2));
    const line = char.repeat(padding);
    console.log(`\n${line}  ${semantic.header(text)}  ${line}\n`);
  });
}

/**
 * Print a divider line.
 */
export function divider(
  options?: { width?: number; char?: string; style?: (text: string) => string },
): Effect.Effect<void> {
  return Effect.sync(() => {
    const {
      width = 60,
      char = symbols.boxHorizontal,
      style: colorStyle = semantic.muted,
    } = options ?? {};
    console.log(colorStyle(char.repeat(width)));
  });
}

/**
 * Print an info/notice box.
 */
export function infoBox(
  content: string | readonly string[],
  config?: Omit<BoxConfig, "borderColor">,
): Effect.Effect<void> {
  return printBox(content, {
    ...config,
    borderColor: semantic.info,
    title: config?.title ?? "Info",
    titleColor: semantic.info,
  });
}

/**
 * Print a warning box.
 */
export function warningBox(
  content: string | readonly string[],
  config?: Omit<BoxConfig, "borderColor">,
): Effect.Effect<void> {
  return printBox(content, {
    ...config,
    borderColor: semantic.warning,
    title: config?.title ?? "Warning",
    titleColor: semantic.warning,
  });
}

/**
 * Print an error box.
 */
export function errorBox(
  content: string | readonly string[],
  config?: Omit<BoxConfig, "borderColor">,
): Effect.Effect<void> {
  return printBox(content, {
    ...config,
    borderColor: semantic.error,
    title: config?.title ?? "Error",
    titleColor: semantic.error,
  });
}

/**
 * Print a success box.
 */
export function successBox(
  content: string | readonly string[],
  config?: Omit<BoxConfig, "borderColor">,
): Effect.Effect<void> {
  return printBox(content, {
    ...config,
    borderColor: semantic.success,
    title: config?.title ?? "Success",
    titleColor: semantic.success,
  });
}
