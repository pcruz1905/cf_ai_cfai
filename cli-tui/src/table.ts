/**
 * Table formatting for structured data display.
 */

import { Effect } from "effect";
import { semantic, padEnd, padStart, center, visibleLength } from "./colors";
import { symbols } from "./symbols";

export interface TableColumn<T> {
  readonly header: string;
  readonly key?: keyof T;
  readonly accessor?: (row: T, index: number) => string;
  readonly width?: number;
  readonly align?: "left" | "center" | "right";
  readonly headerAlign?: "left" | "center" | "right";
}

export interface TableConfig<T> {
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

const boxChars = {
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
    cross: "+",
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
    cross: symbols.boxCross,
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
    cross: symbols.boxCross,
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
    cross: symbols.boxHeavyHorizontal,
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
    cross: symbols.boxDoubleHorizontal,
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
    cross: "",
  },
};

function getCellValue<T>(
  column: TableColumn<T>,
  row: T,
  index: number,
): string {
  if (column.accessor) {
    return column.accessor(row, index);
  }
  if (column.key !== undefined) {
    const value = row[column.key];
    return value === null || value === undefined ? "" : String(value);
  }
  return "";
}

function alignText(
  text: string,
  width: number,
  align: "left" | "center" | "right",
): string {
  switch (align) {
    case "left":
      return padEnd(text, width);
    case "center":
      return center(text, width);
    case "right":
      return padStart(text, width);
  }
}

/**
 * Render a table as an array of strings.
 */
export function renderTable<T>(config: TableConfig<T>): string[] {
  const {
    columns,
    data,
    style = "box",
    indent = 0,
    headerStyle = semantic.header,
    rowStyle,
    showHeader = true,
    showRowNumbers = false,
    maxWidth,
  } = config;

  const chars = boxChars[style];
  const indentStr = " ".repeat(indent);

  // Calculate column widths
  const columnWidths = columns.map((col, colIdx) => {
    if (col.width) return col.width;

    const headerLen = visibleLength(col.header);
    const maxDataLen = data.reduce((max, row, rowIdx) => {
      const cell = getCellValue(col, row, rowIdx);
      return Math.max(max, visibleLength(cell));
    }, 0);

    return Math.max(headerLen, maxDataLen);
  });

  // Add row number column width if needed
  const rowNumWidth = showRowNumbers ? String(data.length).length + 2 : 0;

  // Truncate widths if maxWidth is set
  if (maxWidth) {
    const totalWidth =
      columnWidths.reduce((sum, w) => sum + w, 0) +
      rowNumWidth +
      (columns.length + 1) * 3 +
      indent;

    if (totalWidth > maxWidth) {
      const overflow = totalWidth - maxWidth;
      const lastColIdx = columnWidths.length - 1;
      const lastColWidth = columnWidths[lastColIdx];
      // Shrink last column to fit maxWidth (local array, mutation is intentional)
      if (lastColWidth !== undefined && lastColWidth > overflow + 5) {
        columnWidths[lastColIdx] = lastColWidth - overflow;
      }
    }
  }

  const lines: string[] = [];

  const buildRow = (cells: string[], isHeader = false): string => {
    const parts: string[] = [];
    if (style !== "minimal") {
      parts.push(chars.vertical);
    }

    if (showRowNumbers) {
      parts.push(" ".repeat(rowNumWidth));
      if (style !== "minimal") parts.push(chars.vertical);
    }

    cells.forEach((cell, idx) => {
      const width = columnWidths[idx]!;
      const col = columns[idx]!;
      const align = isHeader
        ? (col.headerAlign ?? col.align ?? "left")
        : (col.align ?? "left");
      const aligned = alignText(cell, width, align);
      parts.push(` ${aligned} `);
      if (style !== "minimal") parts.push(chars.vertical);
    });

    return indentStr + parts.join("");
  };

  const buildSeparator = (
    left: string,
    mid: string,
    right: string,
    line: string,
  ): string => {
    if (style === "minimal") return "";

    const parts: string[] = [left];

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

  // Top border
  if (style !== "minimal") {
    lines.push(
      buildSeparator(
        chars.topLeft,
        chars.teeBottom,
        chars.topRight,
        chars.horizontal,
      ),
    );
  }

  // Header
  if (showHeader) {
    const headerCells = columns.map((col) => headerStyle(col.header));
    lines.push(buildRow(headerCells, true));

    // Header separator
    if (style !== "minimal") {
      lines.push(
        buildSeparator(
          chars.teeRight,
          chars.cross,
          chars.teeLeft,
          chars.horizontal,
        ),
      );
    }
  }

  // Data rows
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

  // Bottom border
  if (style !== "minimal") {
    lines.push(
      buildSeparator(
        chars.bottomLeft,
        chars.teeTop,
        chars.bottomRight,
        chars.horizontal,
      ),
    );
  }

  return lines;
}

/**
 * Print a table to the console.
 */
export function printTable<T>(
  config: TableConfig<T>,
): Effect.Effect<void> {
  return Effect.sync(() => {
    const lines = renderTable(config);
    for (const line of lines) {
      console.log(line);
    }
  });
}

/**
 * Quick table printing from an array of objects.
 */
export function quickTable<T extends Record<string, unknown>>(
  data: readonly T[],
  options?: {
    columns?: readonly (keyof T)[];
    style?: TableConfig<T>["style"];
    indent?: number;
  },
): Effect.Effect<void> {
  if (data.length === 0) return Effect.void;

  const keys = options?.columns ?? (Object.keys(data[0]!) as (keyof T)[]);
  const columns: TableColumn<T>[] = keys.map((key) => ({
    header: String(key),
    key,
    align: "left" as const,
  }));

  return printTable({
    columns,
    data,
    style: options?.style ?? "box",
    indent: options?.indent ?? 0,
  });
}

/**
 * Simple key-value pair display.
 */
export function keyValueTable(
  pairs: readonly (readonly [string, string])[],
  options?: {
    indent?: number;
    keyStyle?: (text: string) => string;
    valueStyle?: (text: string) => string;
    separator?: string;
  },
): Effect.Effect<void> {
  return Effect.sync(() => {
    const {
      indent = 2,
      keyStyle = semantic.label,
      valueStyle = semantic.value,
      separator = ": ",
    } = options ?? {};

    const indentStr = " ".repeat(indent);
    const maxKeyLen = Math.max(...pairs.map(([k]) => visibleLength(k)));

    for (const [key, value] of pairs) {
      const paddedKey = padEnd(key, maxKeyLen);
      console.log(
        `${indentStr}${keyStyle(paddedKey)}${separator}${valueStyle(value)}`,
      );
    }
  });
}

/**
 * Status table for showing status of multiple items.
 */
export interface StatusItem {
  readonly name: string;
  readonly status: "success" | "error" | "warning" | "pending" | "running";
  readonly message?: string;
}

export function statusTable(
  items: readonly StatusItem[],
  options?: { indent?: number },
): Effect.Effect<void> {
  return Effect.sync(() => {
    const { indent = 2 } = options ?? {};
    const indentStr = " ".repeat(indent);

    const statusIcons = {
      success: semantic.success(symbols.success),
      error: semantic.error(symbols.error),
      warning: semantic.warning(symbols.warning),
      pending: semantic.muted(symbols.circle),
      running: semantic.primary(symbols.circleDotted),
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
