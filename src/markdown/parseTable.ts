export type TableRowRange = {
  from: number;
  to: number;
};

export type TableRange = {
  from: number;
  to: number;
  next: number;
  header: TableRowRange;
  delimiter: TableRowRange;
  rows: TableRowRange[];
  pipes: { from: number; to: number }[];
  headerCells: { from: number; to: number }[];
};

const DELIMITER_CELL = /^\s*:?-+:?\s*$/;

/**
 * Parses a GFM pipe table starting at `from`.
 */
export function parseTable(
  source: string,
  from: number,
): TableRange | undefined {
  const header = readLine(source, from);
  if (!header || !header.text.includes("|")) {
    return undefined;
  }
  const delimiter = readLine(source, header.next);
  if (!delimiter || !isDelimiterRow(delimiter.text)) {
    return undefined;
  }

  const rows: TableRowRange[] = [];
  let cursor = delimiter.next;
  while (cursor < source.length) {
    const row = readLine(source, cursor);
    if (!row || row.text.length === 0 || !row.text.includes("|")) {
      break;
    }
    rows.push({ from: row.from, to: row.to });
    cursor = row.next;
  }

  const tableLines = [
    { from: header.from, to: header.to, text: header.text },
    { from: delimiter.from, to: delimiter.to, text: delimiter.text },
    ...rows.map((row) => ({
      from: row.from,
      to: row.to,
      text: source.slice(row.from, row.to),
    })),
  ];
  const last = tableLines[tableLines.length - 1];
  return {
    from,
    to: last.to,
    next: cursor,
    header: { from: header.from, to: header.to },
    delimiter: { from: delimiter.from, to: delimiter.to },
    rows,
    pipes: pipesIn(tableLines),
    headerCells: cellsIn(header.from, header.text),
  };
}

function readLine(
  source: string,
  from: number,
): { from: number; to: number; next: number; text: string } | undefined {
  if (from > source.length) {
    return undefined;
  }
  const newlineAt = source.indexOf("\n", from);
  const to = newlineAt === -1 ? source.length : newlineAt;
  const next = newlineAt === -1 ? source.length : newlineAt + 1;
  return { from, to, next, text: source.slice(from, to) };
}

function isDelimiterRow(line: string): boolean {
  if (!line.includes("|") || !line.includes("-")) {
    return false;
  }
  const cells = splitCells(line);
  return cells.length > 0 && cells.every((cell) => DELIMITER_CELL.test(cell));
}

export type TableGrid = {
  header: string[];
  rows: string[][];
};

/**
 * Splits a parsed table into trimmed header and body cell strings.
 */
export function tableGrid(
  source: string,
  table: Pick<TableRange, "header" | "rows">,
): TableGrid {
  return {
    header: cellsOf(source, table.header),
    rows: table.rows.map((row) => cellsOf(source, row)),
  };
}

function cellsOf(source: string, row: TableRowRange): string[] {
  return splitCells(source.slice(row.from, row.to)).map((cell) => cell.trim());
}

function splitCells(line: string): string[] {
  const raw = line.split("|");
  const start = line.startsWith("|") ? 1 : 0;
  const end = line.endsWith("|") ? raw.length - 1 : raw.length;
  return raw.slice(start, end);
}

function cellsIn(
  lineFrom: number,
  line: string,
): { from: number; to: number }[] {
  const cells: { from: number; to: number }[] = [];
  let offset = line.startsWith("|") ? 1 : 0;
  const parts = splitCells(line);
  for (const part of parts) {
    cells.push({ from: lineFrom + offset, to: lineFrom + offset + part.length });
    offset += part.length + 1;
  }
  return cells;
}

/**
 * Absolute ranges of trimmed cell contents in a table row.
 */
export function cellContentRanges(
  source: string,
  row: TableRowRange,
): { from: number; to: number }[] {
  return cellsIn(row.from, source.slice(row.from, row.to)).map((cell) =>
    trimRange(source, cell.from, cell.to),
  );
}

function trimRange(
  source: string,
  from: number,
  to: number,
): { from: number; to: number } {
  let start = from;
  let end = to;
  while (start < end && isSpace(source[start])) {
    start += 1;
  }
  while (end > start && isSpace(source[end - 1])) {
    end -= 1;
  }
  return { from: start, to: end };
}

function isSpace(ch: string | undefined): boolean {
  return ch === " " || ch === "\t";
}

function pipesIn(
  lines: Array<{ from: number; text: string }>,
): { from: number; to: number }[] {
  const pipes: { from: number; to: number }[] = [];
  for (const line of lines) {
    for (let index = 0; index < line.text.length; index += 1) {
      if (line.text[index] === "|") {
        pipes.push({ from: line.from + index, to: line.from + index + 1 });
      }
    }
  }
  return pipes;
}
