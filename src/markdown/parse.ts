import { parseWikiLink } from "../wikiLink";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type MarkRange = {
  from: number;
  to: number;
};

export type TextSpan = {
  kind: "text";
  from: number;
  to: number;
};

export type MarkedSpan = {
  kind: "strong" | "em" | "code";
  from: number;
  to: number;
  markOpen: MarkRange;
  markClose: MarkRange;
};

export type WikiSpan = {
  kind: "wiki";
  from: number;
  to: number;
  target: string;
  alias: string | undefined;
  markOpen: MarkRange;
  markClose: MarkRange;
  label: MarkRange;
  suppress: MarkRange | undefined;
};

export type InlineSpan = TextSpan | MarkedSpan | WikiSpan;

export type ParagraphBlock = {
  kind: "paragraph";
  from: number;
  to: number;
  children: InlineSpan[];
};

export type HeadingBlock = {
  kind: "heading";
  level: HeadingLevel;
  from: number;
  to: number;
  atxFrom: number;
  atxTo: number;
  children: InlineSpan[];
};

export type Block = ParagraphBlock | HeadingBlock;

const ATX_HEADING = /^(#{1,6}) /;

/**
 * Splits a markdown source string into blocks with source offsets.
 */
export function parseMarkdown(source: string): Block[] {
  if (source.length === 0) {
    return [];
  }

  const blocks: Block[] = [];
  let lineStart = 0;
  while (lineStart <= source.length) {
    const newlineAt = source.indexOf("\n", lineStart);
    const lineEnd = newlineAt === -1 ? source.length : newlineAt;
    const block = parseLine(source, lineStart, lineEnd);
    if (block) {
      blocks.push(block);
    }
    if (newlineAt === -1) {
      break;
    }
    lineStart = newlineAt + 1;
  }
  return blocks;
}

function parseLine(
  source: string,
  from: number,
  to: number,
): Block | undefined {
  if (from === to) {
    return undefined;
  }
  const heading = parseHeadingLine(source, from, to);
  if (heading) {
    return heading;
  }
  return {
    kind: "paragraph",
    from,
    to,
    children: parseInline(source, from, to),
  };
}

function parseHeadingLine(
  source: string,
  from: number,
  to: number,
): HeadingBlock | undefined {
  const line = source.slice(from, to);
  const match = ATX_HEADING.exec(line);
  if (!match) {
    return undefined;
  }
  const hashes = match[1];
  const level = hashes.length as HeadingLevel;
  const atxFrom = from;
  const atxTo = from + hashes.length;
  const contentFrom = atxTo + 1;
  return {
    kind: "heading",
    level,
    from,
    to,
    atxFrom,
    atxTo,
    children: parseInline(source, contentFrom, to),
  };
}

const INLINE_MARKS: ReadonlyArray<{ mark: string; kind: MarkedSpan["kind"] }> = [
  { mark: "`", kind: "code" },
  { mark: "**", kind: "strong" },
  { mark: "*", kind: "em" },
];

function parseInline(source: string, from: number, to: number): InlineSpan[] {
  if (from >= to) {
    return [];
  }
  const children: InlineSpan[] = [];
  let cursor = from;
  let textFrom = from;
  while (cursor < to) {
    const wrapped = matchInlineMark(source, cursor, to);
    if (!wrapped) {
      cursor += 1;
      continue;
    }
    if (wrapped.from > textFrom) {
      children.push({ kind: "text", from: textFrom, to: wrapped.from });
    }
    children.push(wrapped);
    cursor = wrapped.to;
    textFrom = cursor;
  }
  if (textFrom < to) {
    children.push({ kind: "text", from: textFrom, to });
  }
  return children;
}

function matchInlineMark(
  source: string,
  from: number,
  to: number,
): InlineSpan | undefined {
  const wiki = matchWikiSpan(source, from, to);
  if (wiki) {
    return wiki;
  }
  for (const { mark, kind } of INLINE_MARKS) {
    if (!source.startsWith(mark, from)) {
      continue;
    }
    const afterOpen = from + mark.length;
    if (afterOpen >= to) {
      return undefined;
    }
    const closeFrom = source.indexOf(mark, afterOpen);
    if (closeFrom === -1 || closeFrom >= to) {
      return undefined;
    }
    return {
      kind,
      from,
      to: closeFrom + mark.length,
      markOpen: { from, to: afterOpen },
      markClose: { from: closeFrom, to: closeFrom + mark.length },
    };
  }
  return undefined;
}

function matchWikiSpan(
  source: string,
  from: number,
  to: number,
): WikiSpan | undefined {
  const link = parseWikiLink(source, from);
  if (!link || link.to > to) {
    return undefined;
  }
  const innerFrom = from + 2;
  const innerTo = link.to - 2;
  const inner = source.slice(innerFrom, innerTo);
  const pipe = inner.indexOf("|");
  if (pipe === -1) {
    return {
      kind: "wiki",
      from: link.from,
      to: link.to,
      target: link.target,
      alias: undefined,
      markOpen: { from, to: innerFrom },
      markClose: { from: innerTo, to: link.to },
      label: { from: innerFrom, to: innerTo },
      suppress: undefined,
    };
  }
  const pipeAt = innerFrom + pipe;
  return {
    kind: "wiki",
    from: link.from,
    to: link.to,
    target: link.target,
    alias: link.alias,
    markOpen: { from, to: innerFrom },
    markClose: { from: innerTo, to: link.to },
    label: { from: pipeAt + 1, to: innerTo },
    suppress: { from: innerFrom, to: pipeAt + 1 },
  };
}
