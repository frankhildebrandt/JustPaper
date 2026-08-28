export type FrontmatterRange = {
  from: number;
  to: number;
  next: number;
};

const FENCE = "---";

/**
 * Parses a YAML frontmatter fence that must start at offset 0.
 * `to` includes the newline after the closing fence when present.
 */
export function parseFrontmatter(
  source: string,
  from: number,
): FrontmatterRange | undefined {
  if (from !== 0 || !source.startsWith(FENCE, 0)) {
    return undefined;
  }
  const afterOpen = FENCE.length;
  if (afterOpen < source.length && source[afterOpen] !== "\n") {
    return undefined;
  }
  const bodyStart = afterOpen < source.length ? afterOpen + 1 : afterOpen;
  const closeAt = source.indexOf(`\n${FENCE}`, bodyStart - 1);
  if (closeAt === -1) {
    return undefined;
  }
  const fenceFrom = closeAt + 1;
  const fenceTo = fenceFrom + FENCE.length;
  const afterClose = source[fenceTo];
  if (afterClose !== undefined && afterClose !== "\n") {
    return undefined;
  }
  const to = afterClose === "\n" ? fenceTo + 1 : fenceTo;
  return { from: 0, to, next: to };
}
