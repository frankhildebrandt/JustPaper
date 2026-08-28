export type HighlightKind =
  | "keyword"
  | "ident"
  | "string"
  | "comment"
  | "number"
  | "text";

export type HighlightSpan = {
  kind: HighlightKind;
  text: string;
};

const KEYWORDS = new Set([
  "break",
  "case",
  "chan",
  "const",
  "continue",
  "default",
  "defer",
  "else",
  "fallthrough",
  "for",
  "func",
  "go",
  "goto",
  "if",
  "import",
  "interface",
  "map",
  "package",
  "range",
  "return",
  "select",
  "struct",
  "switch",
  "type",
  "var",
  "true",
  "false",
  "nil",
  "iota",
]);

/**
 * Tokenizes Go source into highlight spans for the code card.
 */
export function highlightGo(source: string): HighlightSpan[] {
  const spans: HighlightSpan[] = [];
  let index = 0;
  while (index < source.length) {
    const comment = readComment(source, index);
    if (comment) {
      spans.push(comment.span);
      index = comment.next;
      continue;
    }
    const text = readString(source, index);
    if (text) {
      spans.push(text.span);
      index = text.next;
      continue;
    }
    const number = readNumber(source, index);
    if (number) {
      spans.push(number.span);
      index = number.next;
      continue;
    }
    const ident = readIdent(source, index);
    if (ident) {
      spans.push(ident.span);
      index = ident.next;
      continue;
    }
    const next = nextSpecial(source, index + 1);
    spans.push({ kind: "text", text: source.slice(index, next) });
    index = next;
  }
  return spans;
}

function readComment(
  source: string,
  from: number,
): { span: HighlightSpan; next: number } | undefined {
  if (source.startsWith("//", from)) {
    const newline = source.indexOf("\n", from);
    const next = newline === -1 ? source.length : newline;
    return { span: { kind: "comment", text: source.slice(from, next) }, next };
  }
  if (source.startsWith("/*", from)) {
    const close = source.indexOf("*/", from + 2);
    const next = close === -1 ? source.length : close + 2;
    return { span: { kind: "comment", text: source.slice(from, next) }, next };
  }
  return undefined;
}

function readString(
  source: string,
  from: number,
): { span: HighlightSpan; next: number } | undefined {
  const quote = source[from];
  if (quote !== '"' && quote !== "'" && quote !== "`") {
    return undefined;
  }
  let index = from + 1;
  if (quote === "`") {
    const close = source.indexOf("`", index);
    const next = close === -1 ? source.length : close + 1;
    return { span: { kind: "string", text: source.slice(from, next) }, next };
  }
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === quote) {
      return {
        span: { kind: "string", text: source.slice(from, index + 1) },
        next: index + 1,
      };
    }
    index += 1;
  }
  return { span: { kind: "string", text: source.slice(from) }, next: source.length };
}

function readNumber(
  source: string,
  from: number,
): { span: HighlightSpan; next: number } | undefined {
  if (!isDigit(source[from])) {
    return undefined;
  }
  let index = from + 1;
  while (index < source.length && (isDigit(source[index]) || source[index] === ".")) {
    index += 1;
  }
  return { span: { kind: "number", text: source.slice(from, index) }, next: index };
}

function readIdent(
  source: string,
  from: number,
): { span: HighlightSpan; next: number } | undefined {
  if (!isIdentStart(source[from])) {
    return undefined;
  }
  let index = from + 1;
  while (index < source.length && isIdentPart(source[index])) {
    index += 1;
  }
  const text = source.slice(from, index);
  return {
    span: { kind: KEYWORDS.has(text) ? "keyword" : "ident", text },
    next: index,
  };
}

function nextSpecial(source: string, from: number): number {
  for (let index = from; index < source.length; index += 1) {
    const char = source[index];
    if (
      isIdentStart(char) ||
      isDigit(char) ||
      char === '"' ||
      char === "'" ||
      char === "`" ||
      source.startsWith("//", index) ||
      source.startsWith("/*", index)
    ) {
      return index;
    }
  }
  return source.length;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function isIdentStart(char: string | undefined): boolean {
  return (
    char !== undefined &&
    ((char >= "A" && char <= "Z") ||
      (char >= "a" && char <= "z") ||
      char === "_")
  );
}

function isIdentPart(char: string | undefined): boolean {
  return isIdentStart(char) || isDigit(char);
}
