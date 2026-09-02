import type { DecorationKind, DecorationSpec } from "../markdown/decorationSpecs";
import type { CellNode } from "../markdown/tableCells";
import type { Block, InlineSpan, TypstTableCell, TypstTableGrid } from "./parse";

export type TypstDecorationOptions = {
  showMarks: boolean;
  caret?: number;
  source?: string;
};

/**
 * Turns parsed Typst blocks into decoration ranges for edit and view.
 */
export function typstDecorationSpecs(
  blocks: Block[],
  options: TypstDecorationOptions,
): DecorationSpec[] {
  const specs: DecorationSpec[] = [];
  for (const block of blocks) {
    if (block.kind === "codeblock") {
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
    if (block.kind === "list") {
      specs.push({
        kind: "line-list",
        from: block.from,
        to: block.to,
      });
      specs.push({
        kind: marksShown(options, block.from, block.to) ? "mark" : "hide",
        from: block.mark.from,
        to: block.mark.to,
      });
    }
    for (const child of block.children) {
      specs.push(...inlineSpecs(child, options));
    }
  }
  return specs;
}

/**
 * Returns equals-plus-space ranges so the caret skips the hidden heading gap.
 */
export function typstHeadingPrefixRanges(
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
 * Fingerprint of which marks are revealed for the current caret.
 */
export function typstDecorationRevealKey(
  blocks: Block[],
  options: TypstDecorationOptions,
): string {
  return typstDecorationSpecs(blocks, options)
    .filter((spec) => isRevealSpec(spec.kind))
    .map((spec) => `${spec.kind}:${spec.from}:${spec.to}`)
    .join("|");
}

/**
 * Ranges the caret must skip: heading prefix and currently hidden marks.
 */
export function typstAtomicSyntaxRanges(
  blocks: Block[],
  options: TypstDecorationOptions,
): { from: number; to: number }[] {
  const ranges = [...typstHeadingPrefixRanges(blocks)];
  for (const spec of typstDecorationSpecs(blocks, options)) {
    if (
      (spec.kind === "hide" ||
        spec.kind === "linebreak-widget" ||
        spec.kind === "glyph-widget" ||
        spec.kind === "image-widget" ||
        spec.kind === "hr-widget" ||
        spec.kind === "table-widget") &&
      spec.to > spec.from
    ) {
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
    kind === "linebreak-widget" ||
    kind === "glyph-widget" ||
    kind === "image-widget" ||
    kind === "hr-widget" ||
    kind === "table-widget"
  );
}

function marksShown(
  options: TypstDecorationOptions,
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

function inlineSpecs(
  span: InlineSpan,
  options: TypstDecorationOptions,
): DecorationSpec[] {
  if (span.kind === "text") {
    return [];
  }
  const show = marksShown(options, span.from, span.to);
  if (span.kind === "comment") {
    return [{ kind: "comment", from: span.from, to: span.to }];
  }
  if (span.kind === "link") {
    return [{ kind: "link", from: span.from, to: span.to }];
  }
  if (span.kind === "ref") {
    return [{ kind: "ref", from: span.from, to: span.to }];
  }
  if (span.kind === "linebreak") {
    return [
      {
        kind: show ? "mark" : "linebreak-widget",
        from: span.from,
        to: span.to,
      },
    ];
  }
  if (span.kind === "smartquote" || span.kind === "symbol") {
    if (show) {
      return [{ kind: "mark", from: span.from, to: span.to }];
    }
    return [
      {
        kind: "glyph-widget",
        from: span.from,
        to: span.to,
        glyph: span.glyph,
      },
    ];
  }
  if (span.kind === "label") {
    const markKind = show ? "mark" : "hide";
    return [
      { kind: markKind, from: span.markOpen.from, to: span.markOpen.to },
      { kind: "label", from: span.markOpen.to, to: span.markClose.from },
      { kind: markKind, from: span.markClose.from, to: span.markClose.to },
    ];
  }
  if (span.kind === "hash") {
    if (!show && span.imageSrc !== undefined) {
      return [
        {
          kind: "image-widget",
          from: span.from,
          to: span.to,
          href: span.imageSrc,
          alt: "",
        },
      ];
    }
    if (!show && span.name === "line") {
      return [{ kind: "hr-widget", from: span.from, to: span.to }];
    }
    if (!show && span.table && options.source !== undefined) {
      return [tableWidgetSpec(span.from, span.to, span.table, options)];
    }
    const specs: DecorationSpec[] = [
      {
        kind: "hash",
        from: span.code.from,
        to: span.code.to,
      },
    ];
    if (span.contentOpen) {
      specs.push({
        kind: show ? "mark" : "hide",
        from: span.contentOpen.from,
        to: span.contentOpen.to,
      });
    }
    if (!show && span.textStyle && span.contentOpen) {
      const innerTo = span.contentClose?.from ?? span.to;
      if (innerTo > span.contentOpen.to) {
        specs.push({
          kind: span.textStyle,
          from: span.contentOpen.to,
          to: innerTo,
        });
      }
    }
    for (const child of span.children) {
      specs.push(...inlineSpecs(child, options));
    }
    if (span.contentClose) {
      specs.push({
        kind: show ? "mark" : "hide",
        from: span.contentClose.from,
        to: span.contentClose.to,
      });
    }
    return specs;
  }
  const markKind = show ? "mark" : "hide";
  const innerKind = span.kind;
  const specs: DecorationSpec[] = [
    { kind: markKind, from: span.markOpen.from, to: span.markOpen.to },
    {
      kind: innerKind,
      from: span.markOpen.to,
      to: span.markClose.from,
    },
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

function tableWidgetSpec(
  from: number,
  to: number,
  table: TypstTableGrid,
  options: TypstDecorationOptions,
): DecorationSpec {
  const source = options.source ?? "";
  return {
    kind: "table-widget",
    from,
    to,
    header: table.header.map((cell) => cellNodesFromTypst(source, cell.children)),
    rows: table.rows.map((row) =>
      row.map((cell) => cellNodesFromTypst(source, cell.children)),
    ),
    cellPositions: [table.header, ...table.rows].map((row) =>
      row.map((cell) => cellInnerRange(cell)),
    ),
    opensSource: options.showMarks,
  };
}

function cellInnerRange(cell: TypstTableCell): { from: number; to: number } {
  return { from: cell.from + 1, to: Math.max(cell.from + 1, cell.to - 1) };
}

function cellNodesFromTypst(source: string, spans: InlineSpan[]): CellNode[] {
  const nodes: CellNode[] = [];
  for (const span of spans) {
    if (span.kind === "text") {
      nodes.push({ kind: "text", text: source.slice(span.from, span.to) });
      continue;
    }
    if (span.kind === "smartquote" || span.kind === "symbol") {
      nodes.push({ kind: "text", text: span.glyph });
      continue;
    }
    if (span.kind === "linebreak") {
      nodes.push({ kind: "text", text: " " });
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
        children: cellNodesFromTypst(source, span.children),
      });
      continue;
    }
    if (span.kind === "link") {
      nodes.push({
        kind: "link",
        text: source.slice(span.from, span.to),
        href: span.href,
      });
      continue;
    }
    if (span.kind === "hash") {
      nodes.push(...cellNodesFromTypst(source, span.children));
      if (span.textStyle && span.contentOpen) {
        const innerTo = span.contentClose?.from ?? span.to;
        const text = source.slice(span.contentOpen.to, innerTo);
        if (text.length > 0 && span.children.length === 0) {
          nodes.push({
            kind: span.textStyle,
            children: [{ kind: "text", text }],
          });
        }
      }
    }
  }
  return nodes;
}
