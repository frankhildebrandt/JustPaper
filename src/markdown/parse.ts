import { parseWikiLink } from "../wikiLink";
import {
  DEFAULT_MARKDOWN_FEATURES,
  type MarkdownFeatures,
} from "./features";
import { parseFence } from "./parseFence";
import { parseFrontmatter } from "./parseFrontmatter";
import { parseHr } from "./parseHr";
import { parseInlineLink } from "./parseLink";
import { parseQuote } from "./parseQuote";
import { parseTable } from "./parseTable";
import { parseTodo } from "./parseTodo";

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
  children: InlineSpan[];
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

export type LinkSpan = {
  kind: "link" | "image";
  from: number;
  to: number;
  href: string;
  alt: string;
  markOpen: MarkRange;
  markClose: MarkRange;
  label: MarkRange;
  dest: MarkRange;
};

export type InlineSpan = TextSpan | MarkedSpan | WikiSpan | LinkSpan;

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

export type FrontmatterBlock = {
  kind: "frontmatter";
  from: number;
  to: number;
};

export type QuoteLine = {
  from: number;
  to: number;
  mark: MarkRange;
  children: InlineSpan[];
};

export type BlockquoteBlock = {
  kind: "blockquote";
  from: number;
  to: number;
  lines: QuoteLine[];
  callout:
    | {
        type: string;
        title: string | undefined;
        marker: MarkRange;
        titleRange: MarkRange | undefined;
      }
    | undefined;
};

export type CodeblockBlock = {
  kind: "codeblock";
  from: number;
  to: number;
  open: MarkRange;
  close: MarkRange | undefined;
  language: string;
};

export type TableBlock = {
  kind: "table";
  from: number;
  to: number;
  header: MarkRange;
  delimiter: MarkRange;
  rows: MarkRange[];
  pipes: MarkRange[];
  headerCells: MarkRange[];
};

export type TodoBlock = {
  kind: "todo";
  from: number;
  to: number;
  listMark: MarkRange;
  box: MarkRange;
  checked: boolean;
  contentFrom: number;
  children: InlineSpan[];
};

export type HrBlock = {
  kind: "hr";
  from: number;
  to: number;
};

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | FrontmatterBlock
  | BlockquoteBlock
  | CodeblockBlock
  | TableBlock
  | TodoBlock
  | HrBlock;

const ATX_HEADING = /^(#{1,6}) /;

/**
 * Splits a markdown source string into blocks with source offsets.
 * Disabled features are left as ordinary paragraph text.
 */
export function parseMarkdown(
  source: string,
  features: MarkdownFeatures = DEFAULT_MARKDOWN_FEATURES,
): Block[] {
  if (source.length === 0) {
    return [];
  }

  const blocks: Block[] = [];
  let lineStart = 0;
  while (lineStart <= source.length) {
    if (
      lineStart === 0 &&
      features.frontmatter
    ) {
      const frontmatter = parseFrontmatter(source, 0);
      if (frontmatter) {
        blocks.push({
          kind: "frontmatter",
          from: frontmatter.from,
          to: frontmatter.to,
        });
        lineStart = frontmatter.next;
        continue;
      }
    }
    if (features.codeblock) {
      const fence = parseFence(source, lineStart);
      if (fence) {
        blocks.push({
          kind: "codeblock",
          from: fence.from,
          to: fence.to,
          open: fence.open,
          close: fence.close,
          language: fence.language,
        });
        lineStart = fence.next;
        continue;
      }
    }
    if (features.table) {
      const table = parseTable(source, lineStart);
      if (table) {
        blocks.push({
          kind: "table",
          from: table.from,
          to: table.to,
          header: table.header,
          delimiter: table.delimiter,
          rows: table.rows,
          pipes: table.pipes,
          headerCells: table.headerCells,
        });
        lineStart = table.next;
        continue;
      }
    }
    if (features.blockquote) {
      const quote = parseQuote(source, lineStart);
      if (quote) {
        blocks.push({
          kind: "blockquote",
          from: quote.from,
          to: quote.to,
          callout: quote.callout
            ? {
                type: quote.callout.type,
                title: quote.callout.title,
                marker: quote.callout.marker,
                titleRange: quote.callout.titleRange,
              }
            : undefined,
          lines: quote.lines.map((line, index) => ({
            ...line,
            children: quoteLineChildren(
              source,
              line,
              index,
              quote.callout,
              features,
            ),
          })),
        });
        lineStart = quote.next;
        continue;
      }
    }
    const hr = parseHr(source, lineStart);
    if (hr) {
      blocks.push({
        kind: "hr",
        from: hr.from,
        to: hr.to,
      });
      lineStart = hr.next;
      continue;
    }
    const newlineAt = source.indexOf("\n", lineStart);
    const lineEnd = newlineAt === -1 ? source.length : newlineAt;
    const block = parseLine(source, lineStart, lineEnd, features);
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

/**
 * Inline spans for a quote line; callout markers are left out of the tree.
 */
function quoteLineChildren(
  source: string,
  line: { from: number; to: number; mark: MarkRange },
  index: number,
  callout:
    | {
        marker: MarkRange;
        titleRange: MarkRange | undefined;
      }
    | undefined,
  features: MarkdownFeatures,
): InlineSpan[] {
  if (index === 0 && callout) {
    if (!callout.titleRange) {
      return [];
    }
    return parseInline(
      source,
      callout.titleRange.from,
      callout.titleRange.to,
      features,
    );
  }
  return parseInline(source, line.mark.to, line.to, features);
}

function parseLine(
  source: string,
  from: number,
  to: number,
  features: MarkdownFeatures,
): Block | undefined {
  if (from === to) {
    return undefined;
  }
  if (features.todo) {
    const todo = parseTodo(source, from, to);
    if (todo) {
      return {
        kind: "todo",
        from: todo.from,
        to: todo.to,
        listMark: todo.listMark,
        box: todo.box,
        checked: todo.checked,
        contentFrom: todo.contentFrom,
        children: parseInline(source, todo.contentFrom, to, features),
      };
    }
  }
  if (features.heading) {
    const heading = parseHeadingLine(source, from, to, features);
    if (heading) {
      return heading;
    }
  }
  return {
    kind: "paragraph",
    from,
    to,
    children: parseInline(source, from, to, features),
  };
}

function parseHeadingLine(
  source: string,
  from: number,
  to: number,
  features: MarkdownFeatures,
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
    children: parseInline(source, contentFrom, to, features),
  };
}

const INLINE_MARKS: ReadonlyArray<{ mark: string; kind: MarkedSpan["kind"] }> = [
  { mark: "`", kind: "code" },
  { mark: "**", kind: "strong" },
  { mark: "*", kind: "em" },
];

/**
 * Parses inline markdown in `[from, to)` of `source` (used by table cells).
 */
export function parseInlineMarkdown(
  source: string,
  from: number,
  to: number,
  features: MarkdownFeatures = DEFAULT_MARKDOWN_FEATURES,
): InlineSpan[] {
  return parseInline(source, from, to, features);
}

function parseInline(
  source: string,
  from: number,
  to: number,
  features: MarkdownFeatures,
): InlineSpan[] {
  if (from >= to) {
    return [];
  }
  const children: InlineSpan[] = [];
  let cursor = from;
  let textFrom = from;
  while (cursor < to) {
    const wrapped = matchInlineMark(source, cursor, to, features);
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
  features: MarkdownFeatures,
): InlineSpan | undefined {
  if (features.wiki) {
    const wiki = matchWikiSpan(source, from, to);
    if (wiki) {
      return wiki;
    }
  }
  if (features.image || features.externalLink) {
    const linked = parseInlineLink(source, from);
    if (linked && linked.to <= to) {
      if (linked.kind === "image" && features.image) {
        return linked;
      }
      if (linked.kind === "link" && features.externalLink) {
        return linked;
      }
    }
  }
  if (source.startsWith("**", from) && !features.strong) {
    return undefined;
  }
  for (const { mark, kind } of INLINE_MARKS) {
    if (!featureEnabled(features, kind) || !source.startsWith(mark, from)) {
      continue;
    }
    if (kind === "em" && from > 0 && source[from - 1] === "*") {
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
    const children =
      kind === "code"
        ? []
        : parseInline(source, afterOpen, closeFrom, features);
    return {
      kind,
      from,
      to: closeFrom + mark.length,
      markOpen: { from, to: afterOpen },
      markClose: { from: closeFrom, to: closeFrom + mark.length },
      children,
    };
  }
  return undefined;
}

function featureEnabled(
  features: MarkdownFeatures,
  kind: MarkedSpan["kind"],
): boolean {
  if (kind === "code") {
    return features.inlineCode;
  }
  return features[kind];
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
