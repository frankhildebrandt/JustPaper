import { caretRevealsTable, tableWidgetRange } from "./graphicTable";
import type { Block, HeadingLevel, InlineSpan } from "./parse";
import { parseInlineMarkdown } from "./parse";
import {
  DEFAULT_MARKDOWN_FEATURES,
  type MarkdownFeatures,
} from "./features";
import type { CellNode } from "./tableCells";
import { richTableGrid, cellNodesFromSpans } from "./tableCells";
import { cellContentRanges } from "./parseTable";

export type DecorationKind =
  | `line-h${HeadingLevel}`
  | "atx"
  | "hide"
  | "mark"
  | "strong"
  | "em"
  | "code"
  | "wiki"
  | "frontmatter"
  | "blockquote"
  | "fence"
  | "codeblock"
  | "line-blockquote"
  | "table-pipe"
  | "table-header"
  | "link"
  | "image"
  | "image-widget"
  | "line-todo"
  | "todo-widget"
  | "todo-done"
  | "table-widget"
  | "code-widget"
  | "quote-widget"
  | "hr-widget"
  | "callout-title";

export type DecorationSpec = {
  kind: DecorationKind;
  from: number;
  to: number;
  href?: string;
  alt?: string;
  checked?: boolean;
  header?: CellNode[][];
  rows?: CellNode[][][];
  cellPositions?: Array<Array<{ from: number; to: number }>>;
  language?: string;
  body?: string;
  bodyFrom?: number;
  lines?: string[];
  bodyNodes?: CellNode[][];
  calloutType?: string;
  calloutTitle?: string;
  opensSource?: boolean;
};

export type DecorationOptions = {
  showMarks: boolean;
  graphic?: boolean;
  source?: string;
  caret?: number;
  features?: MarkdownFeatures;
};

/**
 * Turns parsed blocks into decoration ranges for edit and view.
 */
export function decorationSpecs(
  blocks: Block[],
  options: DecorationOptions,
): DecorationSpec[] {
  const specs: DecorationSpec[] = [];
  for (const block of blocks) {
    if (block.kind === "frontmatter") {
      specs.push({
        kind: marksShown(options, block.from, block.to) ? "frontmatter" : "hide",
        from: block.from,
        to: block.to,
      });
      continue;
    }
    if (block.kind === "hr") {
      if (
        !marksShown(options, block.from, block.to) &&
        options.source !== undefined
      ) {
        specs.push({
          kind: "hr-widget",
          from: block.from,
          to: widgetTo(options.source, block.to),
          ...(options.showMarks ? { opensSource: true } : {}),
        });
      } else {
        specs.push({
          kind: options.showMarks ? "mark" : "hide",
          from: block.from,
          to: block.to,
        });
      }
      continue;
    }
    if (block.kind === "codeblock") {
      if (graphicBlock(options, block)) {
        const source = options.source;
        const bodyTo = block.close?.from ?? block.to;
        specs.push({
          kind: "code-widget",
          from: block.from,
          to: widgetTo(source, block.to),
          language: block.language,
          body: source.slice(block.open.to, bodyTo),
          bodyFrom: block.open.to,
          ...(options.showMarks ? { opensSource: true } : {}),
        });
        continue;
      }
      const markKind = marksShown(options, block.from, block.to)
        ? "fence"
        : "hide";
      specs.push({
        kind: markKind,
        from: block.open.from,
        to: block.open.to,
      });
      const bodyFrom = block.open.to;
      const bodyTo = block.close?.from ?? block.to;
      if (bodyTo > bodyFrom) {
        specs.push({ kind: "codeblock", from: bodyFrom, to: bodyTo });
      }
      if (block.close) {
        specs.push({
          kind: markKind,
          from: block.close.from,
          to: block.close.to,
        });
      }
      continue;
    }
    if (block.kind === "blockquote") {
      if (graphicSource(options)) {
        const source = options.source;
        const callout = block.callout;
        const bodyLines = callout ? block.lines.slice(1) : block.lines;
        specs.push({
          kind: "quote-widget",
          from: block.from,
          to: widgetTo(source, block.to),
          lines: bodyLines.map((line) => source.slice(line.mark.to, line.to)),
          ...(callout
            ? {
                calloutType: callout.type,
                calloutTitle: callout.title ?? calloutTitle(callout.type),
                bodyNodes: bodyLines.map((line) =>
                  cellNodesFromSpans(source, line.children),
                ),
              }
            : {}),
        });
        continue;
      }
      for (const line of block.lines) {
        specs.push({
          kind: "line-blockquote",
          from: line.from,
          to: line.to,
          ...(block.callout ? { calloutType: block.callout.type } : {}),
        });
        specs.push({
          kind: marksShown(options, block.from, block.to) ? "mark" : "hide",
          from: line.mark.from,
          to: line.mark.to,
        });
        for (const child of line.children) {
          specs.push(...inlineSpecs(child, options));
        }
      }
      if (block.callout) {
        specs.push({
          kind: marksShown(options, block.from, block.to) ? "mark" : "hide",
          from: block.callout.marker.from,
          to: block.callout.marker.to,
        });
        if (block.callout.titleRange) {
          specs.push({
            kind: "callout-title",
            from: block.callout.titleRange.from,
            to: block.callout.titleRange.to,
          });
        }
      }
      continue;
    }
    if (block.kind === "table") {
      if (graphicBlock(options, block)) {
        const source = options.source;
        const features = options.features ?? DEFAULT_MARKDOWN_FEATURES;
        const grid = richTableGrid(source, block, features);
        const range = tableWidgetRange(source, block);
        specs.push({
          kind: "table-widget",
          from: range.from,
          to: range.to,
          header: grid.header,
          rows: grid.rows,
          cellPositions: tableCellPositions(source, block),
          ...(options.showMarks ? { opensSource: true } : {}),
        });
        continue;
      }
      const hideTo = marksShown(options, block.from, block.to)
        ? undefined
        : (block.rows[0]?.from ?? block.delimiter.to);
      for (const pipe of block.pipes) {
        if (
          hideTo !== undefined &&
          pipe.from >= block.delimiter.from &&
          pipe.from < hideTo
        ) {
          continue;
        }
        specs.push({ kind: "table-pipe", from: pipe.from, to: pipe.to });
      }
      for (const cell of block.headerCells) {
        if (cell.to > cell.from) {
          specs.push({
            kind: "table-header",
            from: cell.from,
            to: cell.to,
          });
        }
      }
      if (options.source !== undefined) {
        specs.push(
          ...tableCellInlineSpecs(options.source, block, options),
        );
      }
      if (hideTo !== undefined && hideTo > block.delimiter.from) {
        specs.push({
          kind: "hide",
          from: block.delimiter.from,
          to: hideTo,
        });
      }
      continue;
    }
    if (block.kind === "todo") {
      specs.push({
        kind: "line-todo",
        from: block.from,
        to: block.to,
      });
      specs.push({
        kind: marksShown(options, block.from, block.to) ? "mark" : "hide",
        from: block.listMark.from,
        to: block.listMark.to,
      });
      specs.push({
        kind: "todo-widget",
        from: block.box.from,
        to: block.box.to,
        checked: block.checked,
      });
      if (block.checked && block.to > block.contentFrom) {
        specs.push({
          kind: "todo-done",
          from: block.contentFrom,
          to: block.to,
        });
      }
      for (const child of block.children) {
        specs.push(...inlineSpecs(child, options));
      }
      continue;
    }
    if (block.kind === "heading") {
      specs.push({
        kind: `line-h${block.level}`,
        from: block.from,
        to: block.to,
      });
      if (marksShown(options, block.from, block.to)) {
        specs.push({
          kind: "atx",
          from: block.atxFrom,
          to: block.atxTo + 1,
        });
      } else {
        specs.push({
          kind: "hide",
          from: block.atxFrom,
          to: block.atxTo + 1,
        });
      }
    }
    for (const child of block.children) {
      specs.push(...inlineSpecs(child, options));
    }
  }
  return specs;
}

/**
 * Returns hash-plus-space ranges so the caret skips the hidden ATX gap.
 */
export function headingPrefixRanges(
  blocks: Block[],
): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  for (const block of blocks) {
    if (block.kind === "heading") {
      ranges.push({ from: block.atxFrom, to: block.atxTo + 1 });
    }
  }
  return ranges;
}

/**
 * Returns task-box ranges so the caret skips the checkbox widget.
 */
export function todoBoxRanges(
  blocks: Block[],
): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  for (const block of blocks) {
    if (block.kind === "todo") {
      ranges.push({ from: block.box.from, to: block.box.to });
    }
  }
  return ranges;
}

/**
 * Fingerprint of which marks/widgets are revealed for the current caret.
 * Stable while the caret stays inside the same construct.
 */
export function decorationRevealKey(
  blocks: Block[],
  options: DecorationOptions,
): string {
  return decorationSpecs(blocks, options)
    .filter((spec) => isRevealSpec(spec.kind))
    .map((spec) => `${spec.kind}:${spec.from}:${spec.to}`)
    .join("|");
}

/**
 * Ranges the caret must skip: ATX prefix, todo box, and currently hidden marks.
 */
export function atomicSyntaxRanges(
  blocks: Block[],
  options: DecorationOptions,
): { from: number; to: number }[] {
  const ranges = [
    ...headingPrefixRanges(blocks),
    ...todoBoxRanges(blocks),
  ];
  for (const spec of decorationSpecs(blocks, options)) {
    if (spec.kind === "hide" && spec.to > spec.from) {
      ranges.push({ from: spec.from, to: spec.to });
    }
  }
  return ranges;
}

function isRevealSpec(kind: DecorationKind): boolean {
  return (
    kind === "hide" ||
    kind === "mark" ||
    kind === "atx" ||
    kind === "fence" ||
    kind === "frontmatter" ||
    kind === "table-widget" ||
    kind === "code-widget" ||
    kind === "quote-widget" ||
    kind === "image-widget" ||
    kind === "todo-widget" ||
    kind === "hr-widget"
  );
}

function graphicSource(
  options: DecorationOptions,
): options is DecorationOptions & { source: string } {
  return (
    options.graphic === true &&
    !options.showMarks &&
    options.source !== undefined
  );
}

function graphicBlock(
  options: DecorationOptions,
  block: { from: number; to: number },
): options is DecorationOptions & { source: string } {
  if (options.graphic !== true || options.source === undefined) {
    return false;
  }
  if (options.showMarks && caretRevealsTable(options.source, block, options.caret)) {
    return false;
  }
  return true;
}

function widgetTo(source: string, to: number): number {
  if (to > 0 && source[to - 1] === "\n") {
    return to;
  }
  return source[to] === "\n" ? to + 1 : to;
}

function marksShown(
  options: DecorationOptions,
  from: number,
  to: number,
): boolean {
  if (!options.showMarks) {
    return false;
  }
  if (options.caret === undefined) {
    return true;
  }
  return options.caret >= from && options.caret <= to;
}

/**
 * Emits inline decorations for markdown inside table cells (source mode).
 */
function tableCellInlineSpecs(
  source: string,
  block: Extract<Block, { kind: "table" }>,
  options: DecorationOptions,
): DecorationSpec[] {
  const features = options.features ?? DEFAULT_MARKDOWN_FEATURES;
  const specs: DecorationSpec[] = [];
  for (const row of [block.header, ...block.rows]) {
    for (const cell of cellContentRanges(source, row)) {
      for (const span of parseInlineMarkdown(
        source,
        cell.from,
        cell.to,
        features,
      )) {
        specs.push(...inlineSpecs(span, options));
      }
    }
  }
  return specs;
}

/**
 * Absolute ranges of trimmed cell contents (header first, then body).
 */
function tableCellPositions(
  source: string,
  block: Extract<Block, { kind: "table" }>,
): Array<Array<{ from: number; to: number }>> {
  return [block.header, ...block.rows].map((row) =>
    cellContentRanges(source, row),
  );
}

function calloutTitle(type: string): string {
  return type.length === 0
    ? "Note"
    : type[0].toUpperCase() + type.slice(1);
}

function inlineSpecs(
  span: InlineSpan,
  options: DecorationOptions,
): DecorationSpec[] {
  if (span.kind === "text") {
    return [];
  }
  const show = marksShown(options, span.from, span.to);
  if (span.kind === "wiki") {
    const markKind = show ? "mark" : "hide";
    const specs: DecorationSpec[] = [
      { kind: markKind, from: span.markOpen.from, to: span.markOpen.to },
    ];
    if (span.suppress && !show) {
      specs.push({
        kind: "hide",
        from: span.suppress.from,
        to: span.suppress.to,
      });
    }
    specs.push({
      kind: "wiki",
      from: span.label.from,
      to: span.label.to,
    });
    specs.push({
      kind: markKind,
      from: span.markClose.from,
      to: span.markClose.to,
    });
    return specs;
  }
  if (span.kind === "image" && !show) {
    return [
      {
        kind: "image-widget",
        from: span.from,
        to: span.to,
        href: span.href,
        alt: span.alt,
      },
    ];
  }
  const inner: DecorationSpec = {
    kind: span.kind,
    from: span.markOpen.to,
    to: span.markClose.from,
  };
  const markKind = show ? "mark" : "hide";
  const specs: DecorationSpec[] = [
    { kind: markKind, from: span.markOpen.from, to: span.markOpen.to },
    inner,
  ];
  if (span.kind === "strong" || span.kind === "em") {
    for (const child of span.children) {
      specs.push(...inlineSpecs(child, options));
    }
  }
  specs.push({
    kind: markKind,
    from: span.markClose.from,
    to: span.markClose.to,
  });
  return specs;
}
