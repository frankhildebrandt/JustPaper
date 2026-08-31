import type { DecorationKind, DecorationSpec } from "../markdown/decorationSpecs";
import type { Block, InlineSpan } from "./parse";

export type TypstDecorationOptions = {
  showMarks: boolean;
  caret?: number;
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
    kind === "fence"
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
  if (span.kind === "label") {
    const markKind = show ? "mark" : "hide";
    return [
      { kind: markKind, from: span.markOpen.from, to: span.markOpen.to },
      { kind: "label", from: span.markOpen.to, to: span.markClose.from },
      { kind: markKind, from: span.markClose.from, to: span.markClose.to },
    ];
  }
  if (span.kind === "hash") {
    const specs: DecorationSpec[] = [
      { kind: "hash", from: span.code.from, to: span.code.to },
    ];
    if (span.contentOpen) {
      specs.push({
        kind: show ? "mark" : "hide",
        from: span.contentOpen.from,
        to: span.contentOpen.to,
      });
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
