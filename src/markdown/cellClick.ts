import {
  DEFAULT_MARKDOWN_FEATURES,
  type MarkdownFeatures,
} from "./features";
import type { InlineSpan } from "./parse";
import { parseInlineMarkdown } from "./parse";

/**
 * Maps a displayed-character index inside a rendered cell to a source offset
 * within that cell's markdown text (marks like ** and ` are not displayed).
 */
export function displayOffsetToSource(
  cellSource: string,
  displayOffset: number,
  features: MarkdownFeatures = DEFAULT_MARKDOWN_FEATURES,
): number {
  const clamped = Math.max(0, displayOffset);
  const spans = parseInlineMarkdown(
    cellSource,
    0,
    cellSource.length,
    features,
  );
  let seen = 0;
  const walk = (nodes: InlineSpan[]): number | undefined => {
    for (const span of nodes) {
      if (span.kind === "text") {
        const len = span.to - span.from;
        // End boundary belongs to the next span (or document end), not this one.
        if (clamped < seen + len) {
          return span.from + (clamped - seen);
        }
        seen += len;
        continue;
      }
      if (span.kind === "code") {
        const len = span.markClose.from - span.markOpen.to;
        if (clamped < seen + len) {
          return span.markOpen.to + (clamped - seen);
        }
        seen += len;
        continue;
      }
      if (span.kind === "strong" || span.kind === "em") {
        const hit = walk(span.children);
        if (hit !== undefined) {
          return hit;
        }
        continue;
      }
      if (span.kind === "wiki" || span.kind === "link") {
        const len = span.label.to - span.label.from;
        if (clamped < seen + len) {
          return span.label.from + (clamped - seen);
        }
        seen += len;
      }
    }
    return undefined;
  };
  return walk(spans) ?? cellSource.length;
}

/**
 * Counts displayed characters in `root` before (node, offset).
 * Returns undefined when `node` is not a text descendant of `root`.
 */
export function textOffsetInElement(
  root: Node,
  node: Node,
  offset: number,
): number | undefined {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let count = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) {
      return count + offset;
    }
    count += (current.textContent ?? "").length;
    current = walker.nextNode();
  }
  return undefined;
}

/**
 * Resolves a mouse position inside a cell element to a display-text offset.
 * Prefers glyph geometry so stretched hit-targets still map to the letter under the cursor.
 */
export function displayOffsetFromPoint(
  cell: HTMLElement,
  clientX: number,
  _clientY: number,
): number {
  const edges = glyphLeftEdges(cell);
  if (edges.length > 0) {
    return offsetFromGlyphEdges(edges, (cell.textContent ?? "").length, clientX);
  }
  const caretRange =
    typeof document.caretRangeFromPoint === "function"
      ? document.caretRangeFromPoint(clientX, _clientY)
      : undefined;
  if (caretRange && cell.contains(caretRange.startContainer)) {
    return (
      textOffsetInElement(
        cell,
        caretRange.startContainer,
        caretRange.startOffset,
      ) ?? 0
    );
  }
  const caretPos =
    typeof document.caretPositionFromPoint === "function"
      ? document.caretPositionFromPoint(clientX, _clientY)
      : null;
  if (caretPos && cell.contains(caretPos.offsetNode)) {
    return (
      textOffsetInElement(cell, caretPos.offsetNode, caretPos.offset) ?? 0
    );
  }
  return 0;
}

function offsetFromGlyphEdges(
  edges: number[],
  textLength: number,
  clientX: number,
): number {
  if (edges.length === 0) {
    return 0;
  }
  let best = 0;
  let bestDist = Infinity;
  for (let index = 0; index < edges.length; index += 1) {
    const dist = Math.abs(edges[index] - clientX);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  }
  const last = edges[edges.length - 1];
  if (clientX > last + 1) {
    return textLength;
  }
  return best;
}

function glyphLeftEdges(cell: HTMLElement): number[] {
  const edges: number[] = [];
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? "";
    for (let index = 0; index < text.length; index += 1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        edges.push(rect.left);
      }
    }
    node = walker.nextNode();
  }
  return edges;
}

/**
 * Source document offset for a click inside a graphic table cell.
 */
export function sourcePosFromCellClick(
  cellSource: string,
  cellFrom: number,
  cell: HTMLElement,
  clientX: number,
  clientY: number,
  features: MarkdownFeatures = DEFAULT_MARKDOWN_FEATURES,
): number {
  const displayOffset = displayOffsetFromPoint(cell, clientX, clientY);
  return (
    cellFrom + displayOffsetToSource(cellSource, displayOffset, features)
  );
}
