/**
 * Returns the document offset at the start of a 1-based line.
 */
export function offsetAtLine(text: string, line: number): number {
  if (line <= 1) {
    return 0;
  }
  let remaining = line - 1;
  let offset = 0;
  while (remaining > 0) {
    const newline = text.indexOf("\n", offset);
    if (newline === -1) {
      return text.length;
    }
    offset = newline + 1;
    remaining -= 1;
  }
  return offset;
}

/**
 * Returns how many visual lines Page Up/Down should move, overlapping one line.
 */
export function linesPerPage(
  editorHeightPx: number,
  lineHeightPx: number,
): number {
  return Math.max(1, Math.floor(editorHeightPx / lineHeightPx) - 1);
}

/**
 * Returns the caret offset after moving `pageLines` visual lines.
 * Soft-wrapped segments of `wrapAt` glyphs count as their own visual lines.
 */
export function offsetAfterPage(
  text: string,
  caret: number,
  direction: 1 | -1,
  pageLines: number,
  wrapAt: number,
): number {
  const lines = visualLineRanges(text, wrapAt);
  let index = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].from <= caret) {
      index = i;
    }
  }
  const column = caret - lines[index].from;
  const next = Math.min(
    lines.length - 1,
    Math.max(0, index + direction * pageLines),
  );
  const target = lines[next];
  return target.from + Math.min(column, target.to - target.from);
}

function visualLineRanges(
  text: string,
  wrapAt: number,
): { from: number; to: number }[] {
  const width = Math.max(1, wrapAt);
  const lines: { from: number; to: number }[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i < text.length && text[i] !== "\n") {
      continue;
    }
    if (i === start) {
      lines.push({ from: start, to: start });
    } else {
      for (let col = start; col < i; col += width) {
        lines.push({ from: col, to: Math.min(col + width, i) });
      }
    }
    start = i + 1;
  }
  return lines;
}
