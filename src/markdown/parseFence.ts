export type FenceRange = {
  from: number;
  to: number;
  next: number;
  open: { from: number; to: number };
  close: { from: number; to: number } | undefined;
  language: string;
};

const FENCE = "```";

/**
 * Parses a backtick-fenced code block starting at `from`.
 * An unclosed fence runs to the end of the document.
 */
export function parseFence(
  source: string,
  from: number,
): FenceRange | undefined {
  if (!source.startsWith(FENCE, from)) {
    return undefined;
  }
  const newlineAt = source.indexOf("\n", from);
  const openEnd = newlineAt === -1 ? source.length : newlineAt;
  if (openEnd < from + FENCE.length) {
    return undefined;
  }
  const language = source.slice(from + FENCE.length, openEnd).trim();
  const openTo = newlineAt === -1 ? openEnd : newlineAt + 1;
  if (newlineAt === -1) {
    return {
      from,
      to: source.length,
      next: source.length,
      open: { from, to: openTo },
      close: undefined,
      language,
    };
  }

  let lineStart = newlineAt + 1;
  while (lineStart <= source.length) {
    const nextNewline = source.indexOf("\n", lineStart);
    const lineEnd = nextNewline === -1 ? source.length : nextNewline;
    const line = source.slice(lineStart, lineEnd);
    if (line.trimEnd() === FENCE) {
      const closeTo = nextNewline === -1 ? lineEnd : nextNewline + 1;
      return {
        from,
        to: closeTo,
        next: closeTo,
        open: { from, to: openTo },
        close: { from: lineStart, to: closeTo },
        language,
      };
    }
    if (nextNewline === -1) {
      break;
    }
    lineStart = nextNewline + 1;
  }

  return {
    from,
    to: source.length,
    next: source.length,
    open: { from, to: openTo },
    close: undefined,
    language,
  };
}
