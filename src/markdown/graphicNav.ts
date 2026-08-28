import { cellContentRanges, type TableRowRange } from "./parseTable";

export type GraphicSpan = {
  from: number;
  to: number;
};

/**
 * Returns the replace range for a graphic block, including a trailing newline
 * when the block does not already end on one (fences include theirs in `to`).
 */
export function tableWidgetRange(
  source: string,
  span: GraphicSpan,
): GraphicSpan {
  if (span.to > span.from && source[span.to - 1] === "\n") {
    return { from: span.from, to: span.to };
  }
  return {
    from: span.from,
    to: source[span.to] === "\n" ? span.to + 1 : span.to,
  };
}

/**
 * Caret position that opens a graphic block when entering from below / the right.
 */
export function graphicEnterEnd(source: string, span: GraphicSpan): number {
  return tableWidgetRange(source, span).to - 1;
}

/**
 * Returns true when the caret sits inside the block and the source should show.
 */
export function caretRevealsTable(
  source: string,
  span: GraphicSpan,
  caret: number | undefined,
): boolean {
  if (caret === undefined) {
    return false;
  }
  const range = tableWidgetRange(source, span);
  if (caret >= range.from && caret < range.to) {
    return true;
  }
  // File ends at the block: keep source open with the caret at EOF.
  return caret === span.to && caret === source.length;
}

/**
 * Vertical arrow: enter a graphic block CM would otherwise skip.
 * Walks through blank lines so a heading→blank→table does not jump past the widget.
 */
export function enterGraphicAlong(
  source: string,
  spans: GraphicSpan[],
  caret: number,
  direction: 1 | -1,
): number | undefined {
  const leave = leaveGraphicAlong(source, spans, caret, direction);
  if (leave !== undefined) {
    return leave;
  }
  for (const span of spans) {
    if (caretRevealsTable(source, span, caret)) {
      return undefined;
    }
  }
  if (direction === 1) {
    return graphicAhead(source, spans, caret);
  }
  return graphicBehind(source, spans, caret);
}

/**
 * Leaves a revealed graphic block on ArrowUp/Down only from its edge line.
 * Interior rows keep normal visual-line motion; down from the last line lands
 * on the next non-blank line (empty lines after a block widget paint the caret
 * to the right of the widget and make the following ArrowDown skip content).
 */
export function leaveGraphicAlong(
  source: string,
  spans: GraphicSpan[],
  caret: number,
  direction: 1 | -1,
): number | undefined {
  for (const span of spans) {
    if (!caretRevealsTable(source, span, caret)) {
      continue;
    }
    const range = tableWidgetRange(source, span);
    const caretLine = lineStart(source, caret);
    if (direction === 1) {
      const lastLine = lineStart(source, Math.max(range.from, range.to - 1));
      if (caretLine !== lastLine) {
        return undefined;
      }
      return nonBlankLineStartAtOrAfter(source, range.to);
    }
    const firstLine = lineStart(source, range.from);
    if (caretLine !== firstLine) {
      return undefined;
    }
    if (range.from === 0) {
      return undefined;
    }
    return range.from - 1;
  }
  return undefined;
}

/**
 * Start of the line at or after `pos` (steps past a mid-line / EOL landing).
 */
export function lineStartAfter(
  source: string,
  pos: number,
): number | undefined {
  if (pos >= source.length) {
    return undefined;
  }
  if (pos === 0 || source[pos - 1] === "\n") {
    return pos;
  }
  const newline = source.indexOf("\n", pos);
  if (newline === -1) {
    return undefined;
  }
  return newline + 1;
}

/**
 * Next non-blank line start at or after `pos`.
 * Skips empty lines that CM draws beside a preceding block widget.
 */
export function nonBlankLineStartAtOrAfter(
  source: string,
  pos: number,
): number | undefined {
  let at = lineStartAfter(source, pos);
  if (at === undefined) {
    return undefined;
  }
  while (at < source.length && lineIsBlank(source, at)) {
    const next = nextLineStart(source, at);
    if (next <= at || next >= source.length) {
      return at;
    }
    at = next;
  }
  return at;
}

/**
 * Horizontal arrow: enter a graphic block from the character beside it.
 */
export function enterGraphicAcross(
  source: string,
  spans: GraphicSpan[],
  caret: number,
  direction: 1 | -1,
): number | undefined {
  for (const span of spans) {
    if (caretRevealsTable(source, span, caret)) {
      return undefined;
    }
  }
  if (direction === 1) {
    const span = spans.find(
      (entry) => tableWidgetRange(source, entry).from === caret + 1,
    );
    return span?.from;
  }
  const span = spans.find(
    (entry) => tableWidgetRange(source, entry).to === caret,
  );
  return span === undefined ? undefined : graphicEnterEnd(source, span);
}

/**
 * Source offset for a clicked table cell (row 0 = header, then body rows).
 */
export function tableClickPos(
  source: string,
  table: { header: TableRowRange; rows: TableRowRange[] },
  row: number,
  column: number,
): number | undefined {
  const rows = [table.header, ...table.rows];
  const target = rows[row];
  if (!target) {
    return undefined;
  }
  const cell = cellContentRanges(source, target)[column];
  return cell?.from;
}

/**
 * Caret or extended selection after clicking a graphic widget.
 */
export function graphicSelection(
  head: number,
  shift: boolean,
  currentAnchor: number,
): { anchor: number; head?: number } {
  if (shift) {
    return { anchor: currentAnchor, head };
  }
  return { anchor: head };
}

/**
 * If a caret move jumped over a graphic block, returns the enter position.
 * When several blocks are crossed, picks the nearest one in travel direction.
 */
export function caretSkippedGraphic(
  source: string,
  spans: GraphicSpan[],
  from: number,
  to: number,
): number | undefined {
  const forward = to >= from;
  let best: number | undefined;
  for (const span of spans) {
    const range = tableWidgetRange(source, span);
    let enter: number | undefined;
    if (from < range.from && to >= range.to) {
      enter = span.from;
    } else if (to < range.from && from >= range.to) {
      enter = graphicEnterEnd(source, span);
    } else if (from < range.from && to >= range.from && to < range.to) {
      // Landed on/inside the atomic widget from outside (CM often stops at from).
      enter = span.from;
    } else if (from > range.to - 1 && to >= range.from && to < range.to) {
      enter = graphicEnterEnd(source, span);
    }
    if (enter === undefined) {
      continue;
    }
    if (best === undefined) {
      best = enter;
      continue;
    }
    if (forward ? enter < best : enter > best) {
      best = enter;
    }
  }
  return best;
}

function graphicAhead(
  source: string,
  spans: GraphicSpan[],
  caret: number,
): number | undefined {
  // Stay out of wrapped mid-line motion; only act at the end of a doc line.
  if (!restOfLineIsBlank(source, caret)) {
    return undefined;
  }
  let pos = nextLineStart(source, caret);
  while (pos < source.length) {
    const span = spans.find((entry) => entry.from === pos);
    if (span) {
      return span.from;
    }
    if (!lineIsBlank(source, pos)) {
      return undefined;
    }
    const next = nextLineStart(source, pos);
    if (next === pos) {
      return undefined;
    }
    pos = next;
  }
  return undefined;
}

function graphicBehind(
  source: string,
  spans: GraphicSpan[],
  caret: number,
): number | undefined {
  // Only act at the start of a line (typical after ArrowUp onto a blank).
  if (caret !== lineStart(source, caret) && !restOfLineIsBlank(source, caret)) {
    return undefined;
  }
  let start = lineStart(source, caret);
  while (true) {
    const span = spans.find(
      (entry) => tableWidgetRange(source, entry).to === start,
    );
    if (span) {
      return graphicEnterEnd(source, span);
    }
    if (start === 0) {
      return undefined;
    }
    const prev = lineStart(source, start - 1);
    if (prev >= start) {
      return undefined;
    }
    if (!lineIsBlank(source, prev)) {
      return undefined;
    }
    start = prev;
  }
}

function restOfLineIsBlank(source: string, caret: number): boolean {
  const newline = source.indexOf("\n", caret);
  const lineTo = newline === -1 ? source.length : newline;
  return source.slice(caret, lineTo).trim().length === 0;
}

function lineIsBlank(source: string, lineFrom: number): boolean {
  const newline = source.indexOf("\n", lineFrom);
  const lineTo = newline === -1 ? source.length : newline;
  return source.slice(lineFrom, lineTo).trim().length === 0;
}

function lineStart(source: string, caret: number): number {
  if (caret <= 0) {
    return 0;
  }
  const newline = source.lastIndexOf("\n", caret - 1);
  return newline === -1 ? 0 : newline + 1;
}

function nextLineStart(source: string, caret: number): number {
  const newline = source.indexOf("\n", caret);
  return newline === -1 ? source.length : newline + 1;
}
