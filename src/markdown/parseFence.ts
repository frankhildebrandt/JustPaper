export type FenceRange = {
  from: number;
  to: number;
  next: number;
  open: { from: number; to: number };
  close: { from: number; to: number } | undefined;
  language: string;
};

const MIN_FENCE_RUN = 3;

/**
 * Parses a backtick-fenced code block starting at `from`.
 * The opening run may be three or more backticks; the block closes on a line
 * holding only a backtick run at least as long. An info string containing a
 * backtick is not a fence. An unclosed fence runs to the end of the document.
 */
export function parseFence(
  source: string,
  from: number,
): FenceRange | undefined {
  const run = backtickRunLength(source, from);
  if (run < MIN_FENCE_RUN) {
    return undefined;
  }
  const newlineAt = source.indexOf("\n", from);
  const openEnd = newlineAt === -1 ? source.length : newlineAt;
  const info = source.slice(from + run, openEnd);
  if (info.includes("`")) {
    return undefined;
  }
  const open = { from, to: newlineAt === -1 ? openEnd : newlineAt + 1 };
  const close =
    newlineAt === -1 ? undefined : findClosingFence(source, open.to, run);
  const to = close?.to ?? source.length;
  return { from, to, next: to, open, close, language: info.trim() };
}

/**
 * Finds the first line from `lineStart` that closes a fence of `run` backticks.
 */
function findClosingFence(
  source: string,
  lineStart: number,
  run: number,
): { from: number; to: number } | undefined {
  while (lineStart <= source.length) {
    const nextNewline = source.indexOf("\n", lineStart);
    const lineEnd = nextNewline === -1 ? source.length : nextNewline;
    if (closesFence(source.slice(lineStart, lineEnd), run)) {
      return {
        from: lineStart,
        to: nextNewline === -1 ? lineEnd : nextNewline + 1,
      };
    }
    if (nextNewline === -1) {
      return undefined;
    }
    lineStart = nextNewline + 1;
  }
  return undefined;
}

/**
 * True when `line` is only a backtick run (plus trailing space) of length >= `run`.
 */
function closesFence(line: string, run: number): boolean {
  const trimmed = line.trimEnd();
  return trimmed.length >= run && backtickRunLength(trimmed, 0) === trimmed.length;
}

function backtickRunLength(source: string, from: number): number {
  let cursor = from;
  while (source[cursor] === "`") {
    cursor += 1;
  }
  return cursor - from;
}
