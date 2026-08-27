import type { HighlightMode } from "./highlightMode";
import { parseMarkdown, type HeadingBlock } from "./markdown/parse";

export type SourceRange = {
  from: number;
  to: number;
};

/**
 * Returns the in-focus source range for the caret, or undefined when
 * nothing should be dimmed.
 */
export function focusRange(
  source: string,
  caret: number,
  mode: HighlightMode,
): SourceRange | undefined {
  if (mode === "none") {
    return undefined;
  }
  if (mode === "paragraph") {
    return rangeAtCaret(paragraphRanges(source), caret);
  }
  if (mode === "sentence") {
    const paragraph = rangeAtCaret(paragraphRanges(source), caret);
    return rangeAtCaret(sentenceRanges(source, paragraph), caret);
  }
  if (mode === "headline") {
    return headlineRange(source, caret);
  }
  return undefined;
}

/**
 * Returns the ranges that should be muted for the caret and mode.
 */
export function dimRanges(
  source: string,
  caret: number,
  mode: HighlightMode,
): SourceRange[] {
  const focus = focusRange(source, caret, mode);
  if (!focus || (focus.from <= 0 && focus.to >= source.length)) {
    return [];
  }
  const ranges: SourceRange[] = [];
  if (focus.from > 0) {
    ranges.push({ from: 0, to: focus.from });
  }
  if (focus.to < source.length) {
    ranges.push({ from: focus.to, to: source.length });
  }
  return ranges;
}

/**
 * Splits source into blank-line paragraphs. Trailing separators belong
 * to the preceding paragraph.
 */
export function paragraphRanges(source: string): SourceRange[] {
  if (source.length === 0) {
    return [{ from: 0, to: 0 }];
  }

  const ranges: SourceRange[] = [];
  let start = 0;
  const separators = /\n\n+/g;
  let match = separators.exec(source);
  while (match) {
    ranges.push({ from: start, to: match.index + match[0].length });
    start = match.index + match[0].length;
    match = separators.exec(source);
  }
  if (start < source.length || ranges.length === 0) {
    ranges.push({ from: start, to: source.length });
  }
  return ranges;
}

/**
 * Splits a paragraph into sentences. A sentence ends at `. ` or at a
 * period whose remainder to the paragraph end is only whitespace.
 */
function sentenceRanges(source: string, paragraph: SourceRange): SourceRange[] {
  const ranges: SourceRange[] = [];
  let start = paragraph.from;
  for (let index = paragraph.from; index < paragraph.to; index += 1) {
    if (source[index] !== ".") {
      continue;
    }
    const after = index + 1;
    if (after < paragraph.to && source[after] === " ") {
      ranges.push({ from: start, to: after + 1 });
      start = after + 1;
      continue;
    }
    if (source.slice(after, paragraph.to).trim() === "") {
      ranges.push({ from: start, to: paragraph.to });
      start = paragraph.to;
      break;
    }
  }
  if (start < paragraph.to) {
    ranges.push({ from: start, to: paragraph.to });
  }
  if (ranges.length === 0) {
    return [paragraph];
  }
  return ranges;
}

/**
 * Returns the ATX heading that contains the caret, plus following
 * content until the next heading of the same or higher level.
 */
function headlineRange(
  source: string,
  caret: number,
): SourceRange | undefined {
  const headings = parseMarkdown(source).filter(
    (block): block is HeadingBlock => block.kind === "heading",
  );
  if (headings.length === 0) {
    return undefined;
  }

  const pos = Math.min(Math.max(caret, 0), source.length);
  let current: HeadingBlock | undefined;
  for (const heading of headings) {
    if (heading.from <= pos) {
      current = heading;
    }
  }
  if (!current) {
    return undefined;
  }

  let sectionEnd = source.length;
  for (const heading of headings) {
    if (heading.from > current.from && heading.level <= current.level) {
      sectionEnd = heading.from;
      break;
    }
  }
  return { from: current.from, to: sectionEnd };
}

/**
 * Returns the index of the blank-line paragraph that contains the caret.
 */
export function activeParagraphIndex(source: string, caret: number): number {
  return indexAtCaret(paragraphRanges(source), caret);
}

function rangeAtCaret(ranges: SourceRange[], caret: number): SourceRange {
  return ranges[indexAtCaret(ranges, caret)];
}

function indexAtCaret(ranges: SourceRange[], caret: number): number {
  const pos = Math.min(Math.max(caret, 0), ranges[ranges.length - 1].to);
  for (let index = 0; index < ranges.length; index += 1) {
    if (pos < ranges[index].to) {
      return index;
    }
  }
  return ranges.length - 1;
}
