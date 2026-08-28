export type HrRange = {
  from: number;
  to: number;
  next: number;
};

/**
 * Parses a thematic break: a line of three or more hyphens only.
 */
export function parseHr(source: string, from: number): HrRange | undefined {
  if (from > source.length) {
    return undefined;
  }
  const newlineAt = source.indexOf("\n", from);
  const to = newlineAt === -1 ? source.length : newlineAt;
  const line = source.slice(from, to);
  if (line.length < 3 || !/^-+$/.test(line)) {
    return undefined;
  }
  return {
    from,
    to,
    next: newlineAt === -1 ? to : newlineAt + 1,
  };
}
