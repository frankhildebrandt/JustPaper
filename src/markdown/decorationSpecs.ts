import type { Block, HeadingLevel, InlineSpan } from "./parse";

export type DecorationKind =
  | `line-h${HeadingLevel}`
  | "atx"
  | "hide"
  | "mark"
  | "strong"
  | "em"
  | "code"
  | "wiki";

export type DecorationSpec = {
  kind: DecorationKind;
  from: number;
  to: number;
};

export type DecorationOptions = {
  showMarks: boolean;
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
    if (block.kind === "heading") {
      specs.push({
        kind: `line-h${block.level}`,
        from: block.from,
        to: block.to,
      });
      if (options.showMarks) {
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
      specs.push(...inlineSpecs(child, options.showMarks));
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

function inlineSpecs(span: InlineSpan, showMarks: boolean): DecorationSpec[] {
  if (span.kind === "text") {
    return [];
  }
  if (span.kind === "wiki") {
    const markKind = showMarks ? "mark" : "hide";
    const specs: DecorationSpec[] = [
      { kind: markKind, from: span.markOpen.from, to: span.markOpen.to },
    ];
    if (span.suppress && !showMarks) {
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
  const inner: DecorationSpec = {
    kind: span.kind,
    from: span.markOpen.to,
    to: span.markClose.from,
  };
  const markKind = showMarks ? "mark" : "hide";
  return [
    { kind: markKind, from: span.markOpen.from, to: span.markOpen.to },
    inner,
    { kind: markKind, from: span.markClose.from, to: span.markClose.to },
  ];
}
