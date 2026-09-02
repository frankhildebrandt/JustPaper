import { parseFence } from "../markdown/parseFence";
import {
  DEFAULT_TYPST_FEATURES,
  type TypstFeatures,
} from "./features";

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
  kind: "strong" | "em" | "code" | "math";
  from: number;
  to: number;
  markOpen: MarkRange;
  markClose: MarkRange;
  children: InlineSpan[];
};

export type CommentSpan = {
  kind: "comment";
  from: number;
  to: number;
};

export type LinkSpan = {
  kind: "link";
  from: number;
  to: number;
  href: string;
};

export type LabelSpan = {
  kind: "label";
  from: number;
  to: number;
  markOpen: MarkRange;
  markClose: MarkRange;
};

export type RefSpan = {
  kind: "ref";
  from: number;
  to: number;
};

export type LinebreakSpan = {
  kind: "linebreak";
  from: number;
  to: number;
};

export type SmartQuoteSpan = {
  kind: "smartquote";
  from: number;
  to: number;
  glyph: string;
};

export type SymbolSpan = {
  kind: "symbol";
  from: number;
  to: number;
  glyph: string;
};

export type TypstTableCell = {
  from: number;
  to: number;
  children: InlineSpan[];
};

export type TypstTableGrid = {
  header: TypstTableCell[];
  rows: TypstTableCell[][];
};

export type HashSpan = {
  kind: "hash";
  from: number;
  to: number;
  name: string;
  imageSrc: string | undefined;
  textStyle: "strong" | "em" | undefined;
  table: TypstTableGrid | undefined;
  code: MarkRange;
  contentOpen: MarkRange | undefined;
  contentClose: MarkRange | undefined;
  children: InlineSpan[];
};

export type InlineSpan =
  | TextSpan
  | MarkedSpan
  | CommentSpan
  | LinkSpan
  | LabelSpan
  | RefSpan
  | LinebreakSpan
  | SmartQuoteSpan
  | SymbolSpan
  | HashSpan;

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

export type CodeblockBlock = {
  kind: "codeblock";
  from: number;
  to: number;
  open: MarkRange;
  close: MarkRange | undefined;
  language: string;
};

export type ListBlock = {
  kind: "list";
  listKind: "bullet" | "enum" | "term";
  from: number;
  to: number;
  mark: MarkRange;
  children: InlineSpan[];
};

export type Block = ParagraphBlock | HeadingBlock | CodeblockBlock | ListBlock;

const HEADING = /^(={1,6}) /;
const LIST_BULLET = /^- /;
const LIST_ENUM = /^\+ /;
const LIST_TERM = /^\/ /;
const STATEMENT_KEYWORDS = new Set([
  "let",
  "set",
  "show",
  "import",
  "include",
]);

const MARKUP_ESCAPE =
  /[\\\[\]{}()*_`$#<>@\/"'~\-.=+?]/;

/**
 * Splits Typst markup into blocks with source offsets.
 * Disabled features are left as ordinary paragraph text.
 */
export function parseTypst(
  source: string,
  features: TypstFeatures = DEFAULT_TYPST_FEATURES,
): Block[] {
  if (source.length === 0) {
    return [];
  }

  const blocks: Block[] = [];
  let lineStart = 0;
  while (lineStart <= source.length) {
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

    const newlineAt = source.indexOf("\n", lineStart);
    const lineEnd = newlineAt === -1 ? source.length : newlineAt;
    const block = parseLine(source, lineStart, lineEnd, features);
    if (block) {
      blocks.push(block);
      lineStart = nextLineStart(source, block.to, newlineAt);
      continue;
    }
    if (newlineAt === -1) {
      break;
    }
    lineStart = newlineAt + 1;
  }
  return blocks;
}

/**
 * Returns the autolink whose range contains `offset`.
 */
export function typstLinkAt(
  source: string,
  offset: number,
  features: TypstFeatures = DEFAULT_TYPST_FEATURES,
): LinkSpan | undefined {
  if (!features.link) {
    return undefined;
  }
  for (const block of parseTypst(source, features)) {
    if (block.kind === "codeblock") {
      continue;
    }
    const found = linkInSpans(block.children, offset);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function linkInSpans(
  spans: InlineSpan[],
  offset: number,
): LinkSpan | undefined {
  for (const span of spans) {
    if (span.kind === "link" && offset >= span.from && offset <= span.to) {
      return span;
    }
    if (span.kind === "strong" || span.kind === "em" || span.kind === "hash") {
      const found = linkInSpans(span.children, offset);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function nextLineStart(
  source: string,
  blockTo: number,
  newlineAt: number,
): number {
  if (blockTo >= source.length) {
    return source.length + 1;
  }
  if (newlineAt !== -1 && blockTo <= newlineAt) {
    return newlineAt + 1;
  }
  if (source[blockTo] === "\n") {
    return blockTo + 1;
  }
  const nextNl = source.indexOf("\n", blockTo);
  return nextNl === -1 ? source.length + 1 : nextNl + 1;
}

function parseLine(
  source: string,
  from: number,
  to: number,
  features: TypstFeatures,
): Block | undefined {
  if (from === to) {
    return undefined;
  }
  if (features.heading) {
    const heading = parseHeadingLine(source, from, to, features);
    if (heading) {
      return heading;
    }
  }
  if (features.list) {
    const list = parseListLine(source, from, to, features);
    if (list) {
      return list;
    }
  }
  const children = parseInline(source, from, to, features);
  const end = spanEnd(children, to);
  return {
    kind: "paragraph",
    from,
    to: end,
    children,
  };
}

function parseHeadingLine(
  source: string,
  from: number,
  to: number,
  features: TypstFeatures,
): HeadingBlock | undefined {
  const line = source.slice(from, to);
  const match = HEADING.exec(line);
  if (!match) {
    return undefined;
  }
  const marks = match[1];
  const level = marks.length as HeadingLevel;
  const atxTo = from + marks.length;
  const contentFrom = atxTo + 1;
  const children = parseInline(source, contentFrom, to, features);
  return {
    kind: "heading",
    level,
    from,
    to: spanEnd(children, to),
    atxFrom: from,
    atxTo,
    children,
  };
}

function parseListLine(
  source: string,
  from: number,
  to: number,
  features: TypstFeatures,
): ListBlock | undefined {
  const line = source.slice(from, to);
  let listKind: ListBlock["listKind"] | undefined;
  if (LIST_BULLET.test(line)) {
    listKind = "bullet";
  } else if (LIST_ENUM.test(line)) {
    listKind = "enum";
  } else if (LIST_TERM.test(line)) {
    listKind = "term";
  }
  if (!listKind) {
    return undefined;
  }
  const markTo = from + 2;
  const children = parseInline(source, markTo, to, features);
  return {
    kind: "list",
    listKind,
    from,
    to: spanEnd(children, to),
    mark: { from, to: markTo },
    children,
  };
}

function spanEnd(children: InlineSpan[], fallback: number): number {
  let end = fallback;
  for (const child of children) {
    if (child.to > end) {
      end = child.to;
    }
  }
  return end;
}

function parseInline(
  source: string,
  from: number,
  to: number,
  features: TypstFeatures,
): InlineSpan[] {
  if (from >= to) {
    return [];
  }
  const children: InlineSpan[] = [];
  let cursor = from;
  let textFrom = from;
  let limit = to;
  while (cursor < limit) {
    const escaped = escapeLength(source, cursor);
    if (escaped > 0) {
      cursor += escaped;
      continue;
    }
    const wrapped = matchInline(source, cursor, features);
    if (!wrapped || wrapped.from !== cursor) {
      cursor += 1;
      continue;
    }
    if (wrapped.from > textFrom) {
      children.push({ kind: "text", from: textFrom, to: wrapped.from });
    }
    children.push(wrapped);
    cursor = wrapped.to;
    textFrom = cursor;
    if (wrapped.to > limit) {
      const lineEnd = lineEndAt(source, wrapped.to);
      if (lineEnd > limit) {
        limit = lineEnd;
      }
    }
  }
  if (textFrom < limit) {
    children.push({ kind: "text", from: textFrom, to: limit });
  }
  return children;
}

function matchInline(
  source: string,
  from: number,
  features: TypstFeatures,
): InlineSpan | undefined {
  if (features.comment) {
    const comment = matchComment(source, from);
    if (comment) {
      return comment;
    }
  }
  if (features.inlineCode) {
    const raw = matchRaw(source, from);
    if (raw) {
      return raw;
    }
  }
  if (features.math) {
    const math = matchMath(source, from);
    if (math) {
      return math;
    }
  }
  if (features.hash) {
    const hash = matchHash(source, from, features);
    if (hash) {
      return hash;
    }
  }
  if (features.linebreak) {
    const linebreak = matchLinebreak(source, from);
    if (linebreak) {
      return linebreak;
    }
  }
  if (features.link) {
    const link = matchLink(source, from);
    if (link) {
      return link;
    }
  }
  if (features.label) {
    const label = matchLabel(source, from);
    if (label) {
      return label;
    }
  }
  if (features.ref) {
    const ref = matchRef(source, from);
    if (ref) {
      return ref;
    }
  }
  if (features.symbols) {
    const symbol = matchSymbol(source, from);
    if (symbol) {
      return symbol;
    }
  }
  if (features.strong) {
    const strong = matchMarked(source, from, "*", "strong", features);
    if (strong) {
      return strong;
    }
  }
  if (features.em) {
    const em = matchMarked(source, from, "_", "em", features);
    if (em) {
      return em;
    }
  }
  if (features.smartquote) {
    return matchSmartQuote(source, from);
  }
  return undefined;
}

function matchLinebreak(source: string, from: number): LinebreakSpan | undefined {
  if (source[from] !== "\\") {
    return undefined;
  }
  if (escapeLength(source, from) > 0) {
    return undefined;
  }
  const next = source[from + 1];
  if (next === " ") {
    return { kind: "linebreak", from, to: from + 2 };
  }
  return { kind: "linebreak", from, to: from + 1 };
}

function matchSymbol(source: string, from: number): SymbolSpan | undefined {
  if (source.startsWith("---", from)) {
    return { kind: "symbol", from, to: from + 3, glyph: "\u2014" };
  }
  if (source.startsWith("--", from)) {
    return { kind: "symbol", from, to: from + 2, glyph: "\u2013" };
  }
  if (source.startsWith("...", from)) {
    return { kind: "symbol", from, to: from + 3, glyph: "\u2026" };
  }
  if (source.startsWith("-?", from)) {
    return { kind: "symbol", from, to: from + 2, glyph: "\u00AD" };
  }
  if (source[from] === "~") {
    return { kind: "symbol", from, to: from + 1, glyph: "\u00A0" };
  }
  return undefined;
}

function matchSmartQuote(source: string, from: number): SmartQuoteSpan | undefined {
  const char = source[from];
  if (char !== "'" && char !== '"') {
    return undefined;
  }
  const opening = from === 0 || isQuoteOpening(source[from - 1]);
  const glyph =
    char === '"'
      ? opening
        ? "\u201C"
        : "\u201D"
      : opening
        ? "\u2018"
        : "\u2019";
  return { kind: "smartquote", from, to: from + 1, glyph };
}

function isQuoteOpening(previous: string | undefined): boolean {
  if (previous === undefined) {
    return true;
  }
  return /\s/.test(previous) || /[(\[{]/.test(previous);
}

function matchComment(source: string, from: number): CommentSpan | undefined {
  if (source.startsWith("//", from)) {
    const end = lineEndAt(source, from);
    return { kind: "comment", from, to: end };
  }
  if (!source.startsWith("/*", from)) {
    return undefined;
  }
  const close = source.indexOf("*/", from + 2);
  return {
    kind: "comment",
    from,
    to: close === -1 ? source.length : close + 2,
  };
}

function matchRaw(source: string, from: number): MarkedSpan | undefined {
  if (source[from] !== "`") {
    return undefined;
  }
  let ticks = 0;
  while (source[from + ticks] === "`") {
    ticks += 1;
  }
  if (ticks === 0) {
    return undefined;
  }
  const openTo = from + ticks;
  const close = source.indexOf("`".repeat(ticks), openTo);
  if (close === -1 || close === openTo) {
    return undefined;
  }
  return {
    kind: "code",
    from,
    to: close + ticks,
    markOpen: { from, to: openTo },
    markClose: { from: close, to: close + ticks },
    children: [],
  };
}

function matchMath(source: string, from: number): MarkedSpan | undefined {
  if (source[from] !== "$") {
    return undefined;
  }
  let cursor = from + 1;
  while (cursor < source.length) {
    const escaped = escapeLength(source, cursor);
    if (escaped > 0) {
      cursor += escaped;
      continue;
    }
    if (source[cursor] === "$") {
      if (cursor === from + 1) {
        return undefined;
      }
      return {
        kind: "math",
        from,
        to: cursor + 1,
        markOpen: { from, to: from + 1 },
        markClose: { from: cursor, to: cursor + 1 },
        children: [],
      };
    }
    cursor += 1;
  }
  return undefined;
}

function matchHash(
  source: string,
  from: number,
  features: TypstFeatures,
): HashSpan | undefined {
  if (source[from] !== "#") {
    return undefined;
  }
  const after = from + 1;
  if (after >= source.length) {
    return undefined;
  }
  const opener = source[after];
  if (opener === "(" || opener === "[" || opener === "{") {
    return hashWithOpener(source, from, after, opener, features);
  }
  const ident = readIdent(source, after);
  if (!ident) {
    return undefined;
  }
  let cursor = ident.to;
  while (source[cursor] === ".") {
    const field = readIdent(source, cursor + 1);
    if (!field) {
      break;
    }
    cursor = field.to;
  }
  if (STATEMENT_KEYWORDS.has(ident.name)) {
    return hashStatement(source, from, cursor, features);
  }
  let paren: { from: number; to: number } | undefined;
  if (source[cursor] === "(") {
    const open = cursor;
    cursor = consumeCodeBalanced(source, cursor) ?? source.length;
    paren = { from: open, to: cursor };
  }
  if (source[cursor] === "[") {
    return hashWithContent(source, from, cursor, features);
  }
  if (source[cursor] === "{") {
    cursor = consumeCodeBalanced(source, cursor) ?? source.length;
  }
  return finishHash(
    source,
    {
      kind: "hash",
      from,
      to: cursor,
      code: { from, to: cursor },
      contentOpen: undefined,
      contentClose: undefined,
      children: [],
    },
    features,
    paren,
  );
}

function hashWithOpener(
  source: string,
  from: number,
  openerAt: number,
  opener: string,
  features: TypstFeatures,
): HashSpan {
  if (opener === "[") {
    return hashWithContent(source, from, openerAt, features);
  }
  const end = consumeCodeBalanced(source, openerAt) ?? source.length;
  return finishHash(source, {
    kind: "hash",
    from,
    to: end,
    code: { from, to: end },
    contentOpen: undefined,
    contentClose: undefined,
    children: [],
  });
}

function hashWithContent(
  source: string,
  from: number,
  openAt: number,
  features: TypstFeatures,
): HashSpan {
  const closeAt = findContentClose(source, openAt + 1);
  const innerTo = closeAt === undefined ? source.length : closeAt;
  const closed = closeAt !== undefined;
  return finishHash(source, {
    kind: "hash",
    from,
    to: closed ? closeAt + 1 : source.length,
    code: { from, to: openAt },
    contentOpen: { from: openAt, to: openAt + 1 },
    contentClose: closed
      ? { from: closeAt, to: closeAt + 1 }
      : undefined,
    children: parseInline(source, openAt + 1, innerTo, features),
  });
}

function hashStatement(
  source: string,
  from: number,
  afterIdent: number,
  features: TypstFeatures,
): HashSpan {
  let cursor = afterIdent;
  let contentOpen: MarkRange | undefined;
  let contentClose: MarkRange | undefined;
  let children: InlineSpan[] = [];
  while (cursor < source.length) {
    if (source[cursor] === "\n") {
      break;
    }
    const skipped = skipCodeAtom(source, cursor);
    if (skipped > cursor) {
      cursor = skipped;
      continue;
    }
    if (source[cursor] === "(" || source[cursor] === "{") {
      cursor = consumeCodeBalanced(source, cursor) ?? source.length;
      continue;
    }
    if (source[cursor] === "[") {
      const hash = hashWithContent(source, from, cursor, features);
      contentOpen = hash.contentOpen;
      contentClose = hash.contentClose;
      children = hash.children;
      cursor = hash.to;
      continue;
    }
    cursor += 1;
  }
  return finishHash(source, {
    kind: "hash",
    from,
    to: cursor,
    code: {
      from,
      to: contentOpen?.from ?? cursor,
    },
    contentOpen,
    contentClose,
    children,
  });
}

function finishHash(
  source: string,
  span: Omit<HashSpan, "name" | "imageSrc" | "textStyle" | "table">,
  features?: TypstFeatures,
  paren?: { from: number; to: number },
): HashSpan {
  const name = hashIdentName(source, span.from);
  const table =
    paren !== undefined && features !== undefined && isTableName(name)
      ? parseTypstTable(source, paren.from + 1, paren.to - 1, features)
      : undefined;
  return {
    ...span,
    name,
    imageSrc:
      name === "image"
        ? firstStringLiteral(source, span.from, span.code.to)
        : undefined,
    textStyle:
      name === "text"
        ? textStyleFromCode(source, span.code.from, span.code.to)
        : undefined,
    table,
  };
}

function isTableName(name: string): boolean {
  return name === "table" || name.endsWith("-table");
}

function parseTypstTable(
  source: string,
  from: number,
  to: number,
  features: TypstFeatures,
): TypstTableGrid | undefined {
  let columns: number | undefined;
  let header: TypstTableCell[] | undefined;
  const cells: TypstTableCell[] = [];
  let cursor = from;
  while (cursor < to) {
    const skipped = skipCodeAtom(source, cursor);
    if (skipped > cursor) {
      cursor = skipped;
      continue;
    }
    const namedColumns = readColumnsArg(source, cursor, to);
    if (namedColumns) {
      columns = namedColumns.count;
      cursor = namedColumns.to;
      continue;
    }
    const headerCall = readTableHeader(source, cursor, to, features);
    if (headerCall) {
      header = headerCall.cells;
      cursor = headerCall.to;
      continue;
    }
    const named = skipNamedArg(source, cursor, to);
    if (named !== undefined) {
      cursor = named;
      continue;
    }
    if (source[cursor] === "[") {
      const cell = readContentCell(source, cursor, features);
      cells.push(cell);
      cursor = cell.to;
      continue;
    }
    if (source[cursor] === "(" || source[cursor] === "{") {
      cursor = consumeCodeBalanced(source, cursor) ?? to;
      continue;
    }
    cursor += 1;
  }
  const colCount = columns ?? header?.length;
  if (colCount === undefined || colCount < 1) {
    return undefined;
  }
  const headerRow = header ?? cells.splice(0, colCount);
  if (headerRow.length === 0) {
    return undefined;
  }
  const rows: TypstTableCell[][] = [];
  for (let index = 0; index < cells.length; index += colCount) {
    rows.push(cells.slice(index, index + colCount));
  }
  return { header: headerRow, rows };
}

function readColumnsArg(
  source: string,
  from: number,
  to: number,
): { count: number; to: number } | undefined {
  const ident = readIdent(source, from);
  if (ident?.name !== "columns") {
    return undefined;
  }
  let cursor = skipSpaces(source, ident.to, to);
  if (source[cursor] !== ":") {
    return undefined;
  }
  cursor = skipSpaces(source, cursor + 1, to);
  if (source[cursor] === "(") {
    const end = consumeCodeBalanced(source, cursor) ?? to;
    return {
      count: Math.max(1, countCommaItems(source, cursor + 1, end - 1)),
      to: end,
    };
  }
  const digits = /^\d+/.exec(source.slice(cursor, to));
  if (!digits) {
    return undefined;
  }
  return { count: Number(digits[0]), to: cursor + digits[0].length };
}

function readTableHeader(
  source: string,
  from: number,
  to: number,
  features: TypstFeatures,
): { cells: TypstTableCell[]; to: number } | undefined {
  const ident = readIdent(source, from);
  if (ident?.name !== "table") {
    return undefined;
  }
  let cursor = skipSpaces(source, ident.to, to);
  if (source[cursor] !== ".") {
    return undefined;
  }
  cursor = skipSpaces(source, cursor + 1, to);
  const field = readIdent(source, cursor);
  if (field?.name !== "header") {
    return undefined;
  }
  cursor = skipSpaces(source, field.to, to);
  if (source[cursor] !== "(") {
    return undefined;
  }
  const end = consumeCodeBalanced(source, cursor) ?? to;
  return {
    cells: collectContentCells(source, cursor + 1, end - 1, features),
    to: end,
  };
}

function skipNamedArg(
  source: string,
  from: number,
  to: number,
): number | undefined {
  const ident = readIdent(source, from);
  if (!ident) {
    return undefined;
  }
  let cursor = skipSpaces(source, ident.to, to);
  if (source[cursor] !== ":") {
    return undefined;
  }
  cursor = skipSpaces(source, cursor + 1, to);
  if (source[cursor] === "[") {
    return readContentCell(source, cursor, DEFAULT_TYPST_FEATURES).to;
  }
  if (source[cursor] === "(" || source[cursor] === "{") {
    return consumeCodeBalanced(source, cursor) ?? to;
  }
  const skipped = skipCodeAtom(source, cursor);
  if (skipped > cursor) {
    return skipped;
  }
  while (cursor < to && /[\w.\-]/.test(source[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor === ident.to ? undefined : cursor;
}

function collectContentCells(
  source: string,
  from: number,
  to: number,
  features: TypstFeatures,
): TypstTableCell[] {
  const cells: TypstTableCell[] = [];
  let cursor = from;
  while (cursor < to) {
    const skipped = skipCodeAtom(source, cursor);
    if (skipped > cursor) {
      cursor = skipped;
      continue;
    }
    if (source[cursor] === "[") {
      const cell = readContentCell(source, cursor, features);
      cells.push(cell);
      cursor = cell.to;
      continue;
    }
    if (source[cursor] === "(" || source[cursor] === "{") {
      cursor = consumeCodeBalanced(source, cursor) ?? to;
      continue;
    }
    cursor += 1;
  }
  return cells;
}

function readContentCell(
  source: string,
  openAt: number,
  features: TypstFeatures,
): TypstTableCell {
  const closeAt = findContentClose(source, openAt + 1);
  const innerTo = closeAt === undefined ? source.length : closeAt;
  return {
    from: openAt,
    to: closeAt === undefined ? source.length : closeAt + 1,
    children: parseInline(source, openAt + 1, innerTo, features),
  };
}

function countCommaItems(source: string, from: number, to: number): number {
  let count = 0;
  let depth = 0;
  let seen = false;
  let cursor = from;
  while (cursor < to) {
    const skipped = skipCodeAtom(source, cursor);
    if (skipped > cursor) {
      seen = true;
      cursor = skipped;
      continue;
    }
    const char = source[cursor];
    if (char === "(" || char === "[" || char === "{") {
      depth += 1;
      seen = true;
    } else if (char === ")" || char === "]" || char === "}") {
      depth = Math.max(0, depth - 1);
    } else if (char === "," && depth === 0) {
      if (seen) {
        count += 1;
      }
      seen = false;
    } else if (char !== undefined && !/\s/.test(char)) {
      seen = true;
    }
    cursor += 1;
  }
  if (seen) {
    count += 1;
  }
  return count;
}

function skipSpaces(source: string, from: number, to: number): number {
  let cursor = from;
  while (cursor < to && /\s/.test(source[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor;
}

function hashIdentName(source: string, from: number): string {
  if (source[from] !== "#") {
    return "";
  }
  return readIdent(source, from + 1)?.name ?? "";
}

function firstStringLiteral(
  source: string,
  from: number,
  to: number,
): string | undefined {
  let cursor = from;
  while (cursor < to) {
    if (source[cursor] === "\"") {
      const end = skipString(source, cursor);
      if (end > cursor + 1) {
        return source.slice(cursor + 1, end - 1);
      }
      return undefined;
    }
    cursor += 1;
  }
  return undefined;
}

function textStyleFromCode(
  source: string,
  from: number,
  to: number,
): "strong" | "em" | undefined {
  const code = source.slice(from, to);
  if (/weight:\s*(?:"bold"|'bold'|"black"|'black'|[7-9]00)/.test(code)) {
    return "strong";
  }
  if (/style:\s*(?:"italic"|'italic')/.test(code)) {
    return "em";
  }
  return undefined;
}

function matchLink(source: string, from: number): LinkSpan | undefined {
  if (!source.startsWith("http://", from) && !source.startsWith("https://", from)) {
    return undefined;
  }
  let end = from;
  while (end < source.length) {
    const char = source[end];
    if (char === undefined || /\s/.test(char) || char === "<" || char === ">") {
      break;
    }
    end += 1;
  }
  while (end > from && /[.,;:!?)]/.test(source[end - 1] ?? "")) {
    end -= 1;
  }
  if (end <= from + 7) {
    return undefined;
  }
  return {
    kind: "link",
    from,
    to: end,
    href: source.slice(from, end),
  };
}

function matchLabel(source: string, from: number): LabelSpan | undefined {
  if (source[from] !== "<") {
    return undefined;
  }
  const ident = readIdent(source, from + 1);
  if (!ident || source[ident.to] !== ">") {
    return undefined;
  }
  return {
    kind: "label",
    from,
    to: ident.to + 1,
    markOpen: { from, to: from + 1 },
    markClose: { from: ident.to, to: ident.to + 1 },
  };
}

function matchRef(source: string, from: number): RefSpan | undefined {
  if (source[from] !== "@") {
    return undefined;
  }
  const ident = readIdent(source, from + 1);
  if (!ident) {
    return undefined;
  }
  return { kind: "ref", from, to: ident.to };
}

function matchMarked(
  source: string,
  from: number,
  mark: string,
  kind: "strong" | "em",
  features: TypstFeatures,
): MarkedSpan | undefined {
  if (source[from] !== mark) {
    return undefined;
  }
  const afterOpen = from + 1;
  const close = findUnescaped(source, mark, afterOpen);
  if (close === undefined || close === afterOpen) {
    return undefined;
  }
  if (source.indexOf("\n", afterOpen) !== -1 && source.indexOf("\n", afterOpen) < close) {
    return undefined;
  }
  return {
    kind,
    from,
    to: close + 1,
    markOpen: { from, to: afterOpen },
    markClose: { from: close, to: close + 1 },
    children: parseInline(source, afterOpen, close, features),
  };
}

function findUnescaped(
  source: string,
  char: string,
  from: number,
): number | undefined {
  let cursor = from;
  while (cursor < source.length) {
    const escaped = escapeLength(source, cursor);
    if (escaped > 0) {
      cursor += escaped;
      continue;
    }
    if (source[cursor] === char) {
      return cursor;
    }
    if (source[cursor] === "\n") {
      return undefined;
    }
    cursor += 1;
  }
  return undefined;
}

function findContentClose(source: string, from: number): number | undefined {
  let cursor = from;
  while (cursor < source.length) {
    const escaped = escapeLength(source, cursor);
    if (escaped > 0) {
      cursor += escaped;
      continue;
    }
    const comment = matchComment(source, cursor);
    if (comment) {
      cursor = comment.to;
      continue;
    }
    const raw = matchRaw(source, cursor);
    if (raw) {
      cursor = raw.to;
      continue;
    }
    const math = matchMath(source, cursor);
    if (math) {
      cursor = math.to;
      continue;
    }
    const hash = matchHash(source, cursor, DEFAULT_TYPST_FEATURES);
    if (hash) {
      cursor = hash.to;
      continue;
    }
    if (source[cursor] === "]") {
      return cursor;
    }
    cursor += 1;
  }
  return undefined;
}

function consumeCodeBalanced(source: string, from: number): number | undefined {
  const open = source[from];
  const close = open === "(" ? ")" : open === "{" ? "}" : open === "[" ? "]" : undefined;
  if (!close) {
    return undefined;
  }
  let depth = 1;
  let cursor = from + 1;
  while (cursor < source.length) {
    const skipped = skipCodeAtom(source, cursor);
    if (skipped > cursor) {
      cursor = skipped;
      continue;
    }
    const char = source[cursor];
    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return cursor + 1;
      }
    }
    cursor += 1;
  }
  return source.length;
}

function skipCodeAtom(source: string, from: number): number {
  const escaped = escapeLength(source, from);
  if (escaped > 0) {
    return from + escaped;
  }
  if (source[from] === "\"") {
    return skipString(source, from);
  }
  if (source.startsWith("//", from)) {
    return lineEndAt(source, from);
  }
  if (source.startsWith("/*", from)) {
    const close = source.indexOf("*/", from + 2);
    return close === -1 ? source.length : close + 2;
  }
  if (source[from] === "`") {
    const raw = matchRaw(source, from);
    if (raw) {
      return raw.to;
    }
  }
  return from;
}

function skipString(source: string, from: number): number {
  let cursor = from + 1;
  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (source[cursor] === "\"") {
      return cursor + 1;
    }
    cursor += 1;
  }
  return source.length;
}

function readIdent(
  source: string,
  from: number,
): { name: string; to: number } | undefined {
  if (from >= source.length || !isIdentStart(source, from)) {
    return undefined;
  }
  let cursor = from + identCharLength(source, from);
  while (cursor < source.length && isIdentContinue(source, cursor)) {
    cursor += identCharLength(source, cursor);
  }
  return { name: source.slice(from, cursor), to: cursor };
}

function isIdentStart(source: string, index: number): boolean {
  const char = source[index];
  if (char === "_") {
    return true;
  }
  return /\p{L}/u.test(char ?? "");
}

function isIdentContinue(source: string, index: number): boolean {
  const char = source[index];
  if (char === "_" || char === "-") {
    return true;
  }
  return /[\p{L}\p{N}]/u.test(char ?? "");
}

function identCharLength(source: string, index: number): number {
  const code = source.codePointAt(index);
  if (code === undefined) {
    return 1;
  }
  return code > 0xffff ? 2 : 1;
}

function escapeLength(source: string, from: number): number {
  if (source[from] !== "\\") {
    return 0;
  }
  if (source.startsWith("\\u{", from)) {
    const close = source.indexOf("}", from + 3);
    if (close !== -1) {
      return close + 1 - from;
    }
  }
  const next = source[from + 1];
  if (next !== undefined && MARKUP_ESCAPE.test(next)) {
    return 2;
  }
  return 0;
}

function lineEndAt(source: string, from: number): number {
  const newline = source.indexOf("\n", from);
  return newline === -1 ? source.length : newline;
}
