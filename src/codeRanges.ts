import { parseFence } from "./markdown/parseFence";

export type CodeRange = {
  from: number;
  to: number;
};

/**
 * Returns fenced code blocks and single-line inline code spans in source
 * order. Inline spans close on a backtick run of the same length.
 */
export function codeRanges(source: string): CodeRange[] {
  const ranges: CodeRange[] = [];
  let lineStart = 0;
  while (lineStart < source.length) {
    const fence = parseFence(source, lineStart);
    if (fence) {
      ranges.push({ from: fence.from, to: fence.to });
      lineStart = fence.next;
      continue;
    }
    const newlineAt = source.indexOf("\n", lineStart);
    const lineEnd = newlineAt === -1 ? source.length : newlineAt;
    ranges.push(...inlineCodeRanges(source, lineStart, lineEnd));
    lineStart = lineEnd + 1;
  }
  return ranges;
}

/**
 * Returns the code range that contains `offset`, if any.
 */
export function codeRangeAt(
  ranges: readonly CodeRange[],
  offset: number,
): CodeRange | undefined {
  return ranges.find((range) => offset >= range.from && offset < range.to);
}

function inlineCodeRanges(source: string, from: number, to: number): CodeRange[] {
  const ranges: CodeRange[] = [];
  let cursor = from;
  while (cursor < to) {
    const open = source.indexOf("`", cursor);
    if (open === -1 || open >= to) {
      break;
    }
    const width = backtickRunLength(source, open, to);
    const close = closingRunAt(source, open + width, to, width);
    if (close === undefined) {
      cursor = open + width;
      continue;
    }
    ranges.push({ from: open, to: close + width });
    cursor = close + width;
  }
  return ranges;
}

function closingRunAt(
  source: string,
  from: number,
  to: number,
  width: number,
): number | undefined {
  let cursor = from;
  while (cursor < to) {
    const at = source.indexOf("`", cursor);
    if (at === -1 || at >= to) {
      return undefined;
    }
    const run = backtickRunLength(source, at, to);
    if (run === width) {
      return at;
    }
    cursor = at + run;
  }
  return undefined;
}

function backtickRunLength(source: string, from: number, to: number): number {
  let cursor = from;
  while (cursor < to && source[cursor] === "`") {
    cursor += 1;
  }
  return cursor - from;
}
