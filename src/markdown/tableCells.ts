import {
  DEFAULT_MARKDOWN_FEATURES,
  type MarkdownFeatures,
} from "./features";
import type { InlineSpan } from "./parse";
import { parseInlineMarkdown } from "./parse";
import type { TableRange, TableRowRange } from "./parseTable";
import { splitCells } from "./parseTable";

export type CellNode =
  | { kind: "text"; text: string }
  | { kind: "strong" | "em" | "code"; children: CellNode[] }
  | { kind: "wiki" | "link"; text: string; href?: string };

export type RichTableGrid = {
  header: CellNode[][];
  rows: CellNode[][][];
};

/**
 * Builds a table grid where each cell is parsed as inline markdown.
 */
export function richTableGrid(
  source: string,
  table: Pick<TableRange, "header" | "rows">,
  features: MarkdownFeatures = DEFAULT_MARKDOWN_FEATURES,
): RichTableGrid {
  return {
    header: richCells(source, table.header, features),
    rows: table.rows.map((row) => richCells(source, row, features)),
  };
}

/**
 * Converts absolute-offset inline spans into a DOM-ready cell tree.
 */
export function cellNodesFromSpans(
  source: string,
  spans: InlineSpan[],
): CellNode[] {
  const nodes: CellNode[] = [];
  for (const span of spans) {
    if (span.kind === "text") {
      nodes.push({ kind: "text", text: source.slice(span.from, span.to) });
      continue;
    }
    if (span.kind === "code") {
      nodes.push({
        kind: "code",
        children: [
          {
            kind: "text",
            text: source.slice(span.markOpen.to, span.markClose.from),
          },
        ],
      });
      continue;
    }
    if (span.kind === "strong" || span.kind === "em") {
      nodes.push({
        kind: span.kind,
        children: cellNodesFromSpans(source, span.children),
      });
      continue;
    }
    if (span.kind === "wiki") {
      nodes.push({
        kind: "wiki",
        text: source.slice(span.label.from, span.label.to),
      });
      continue;
    }
    if (span.kind === "link") {
      nodes.push({
        kind: "link",
        text: source.slice(span.label.from, span.label.to),
        href: span.href,
      });
      continue;
    }
    if (span.kind === "image") {
      nodes.push({ kind: "text", text: span.alt });
    }
  }
  return nodes;
}

function richCells(
  source: string,
  row: TableRowRange,
  features: MarkdownFeatures,
): CellNode[][] {
  return cellTexts(source, row).map((text) => {
    const spans = parseInlineMarkdown(text, 0, text.length, features);
    return cellNodesFromSpans(text, spans);
  });
}

function cellTexts(source: string, row: TableRowRange): string[] {
  return splitCells(source.slice(row.from, row.to)).map((cell) => cell.trim());
}
