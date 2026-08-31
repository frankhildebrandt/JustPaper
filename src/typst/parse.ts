import { parseFence } from "../markdown/parseFence";

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

export type HashSpan = {
  kind: "hash";
  from: number;
  to: number;
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

/**
 * Splits Typst markup into blocks with source offsets.
 */
export function parseTypst(source: string): Block[] {
  if (source.length === 0) {
    return [];
  }

  const blocks: Block[] = [];
  let lineStart = 0;
  while (lineStart <= source.length) {
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

    const newlineAt = source.indexOf("\n", lineStart);
    const lineEnd = newlineAt === -1 ? source.length : newlineAt;
    const block = parseLine(source, lineStart, lineEnd);
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
): LinkSpan | undefined {
  for (const block of parseTypst(source)) {
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
): Block | undefined {
  if (from === to) {
    return undefined;
  }
  const heading = parseHeadingLine(source, from, to);
  if (heading) {
    return heading;
  }
  const list = parseListLine(source, from, to);
  if (list) {
    return list;
  }
  const children = parseInline(source, from, to);
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
  const children = parseInline(source, contentFrom, to);
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
  const children = parseInline(source, markTo, to);
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

function parseInline(source: string, from: number, to: number): InlineSpan[] {
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
    const wrapped = matchInline(source, cursor);
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

function matchInline(source: string, from: number): InlineSpan | undefined {
  const comment = matchComment(source, from);
  if (comment) {
    return comment;
  }
  const raw = matchRaw(source, from);
  if (raw) {
    return raw;
  }
  const math = matchMath(source, from);
  if (math) {
    return math;
  }
  const hash = matchHash(source, from);
  if (hash) {
    return hash;
  }
  const link = matchLink(source, from);
  if (link) {
    return link;
  }
  const label = matchLabel(source, from);
  if (label) {
    return label;
  }
  const ref = matchRef(source, from);
  if (ref) {
    return ref;
  }
  const strong = matchMarked(source, from, "*", "strong");
  if (strong) {
    return strong;
  }
  return matchMarked(source, from, "_", "em");
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

function matchHash(source: string, from: number): HashSpan | undefined {
  if (source[from] !== "#") {
    return undefined;
  }
  const after = from + 1;
  if (after >= source.length) {
    return undefined;
  }
  const opener = source[after];
  if (opener === "(" || opener === "[" || opener === "{") {
    return hashWithOpener(source, from, after, opener);
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
    return hashStatement(source, from, cursor);
  }
  if (source[cursor] === "(") {
    cursor = consumeCodeBalanced(source, cursor) ?? source.length;
  }
  if (source[cursor] === "[") {
    return hashWithContent(source, from, cursor);
  }
  if (source[cursor] === "{") {
    cursor = consumeCodeBalanced(source, cursor) ?? source.length;
  }
  return {
    kind: "hash",
    from,
    to: cursor,
    code: { from, to: cursor },
    contentOpen: undefined,
    contentClose: undefined,
    children: [],
  };
}

function hashWithOpener(
  source: string,
  from: number,
  openerAt: number,
  opener: string,
): HashSpan {
  if (opener === "[") {
    return hashWithContent(source, from, openerAt);
  }
  const end = consumeCodeBalanced(source, openerAt) ?? source.length;
  return {
    kind: "hash",
    from,
    to: end,
    code: { from, to: end },
    contentOpen: undefined,
    contentClose: undefined,
    children: [],
  };
}

function hashWithContent(
  source: string,
  from: number,
  openAt: number,
): HashSpan {
  const closeAt = findContentClose(source, openAt + 1);
  const innerTo = closeAt === undefined ? source.length : closeAt;
  const closed = closeAt !== undefined;
  return {
    kind: "hash",
    from,
    to: closed ? closeAt + 1 : source.length,
    code: { from, to: openAt },
    contentOpen: { from: openAt, to: openAt + 1 },
    contentClose: closed
      ? { from: closeAt, to: closeAt + 1 }
      : undefined,
    children: parseInline(source, openAt + 1, innerTo),
  };
}

function hashStatement(source: string, from: number, afterIdent: number): HashSpan {
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
      const hash = hashWithContent(source, from, cursor);
      contentOpen = hash.contentOpen;
      contentClose = hash.contentClose;
      children = hash.children;
      cursor = hash.to;
      continue;
    }
    cursor += 1;
  }
  return {
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
  };
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
    children: parseInline(source, afterOpen, close),
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
    const hash = matchHash(source, cursor);
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
  if (from + 1 >= source.length) {
    return 1;
  }
  return 2;
}

function lineEndAt(source: string, from: number): number {
  const newline = source.indexOf("\n", from);
  return newline === -1 ? source.length : newline;
}
