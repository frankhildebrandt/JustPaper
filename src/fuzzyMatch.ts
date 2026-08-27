/**
 * Filters and ranks project-relative paths by a fuzzy subsequence query.
 */
export function fuzzyMatch(
  files: readonly string[],
  query: string,
): string[] {
  if (query.length === 0) {
    return [...files];
  }
  const needle = query.toLowerCase();
  const scored: { path: string; score: number }[] = [];
  for (const path of files) {
    const score = matchScore(path, needle);
    if (score === undefined) {
      continue;
    }
    scored.push({ path, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.path.localeCompare(b.path))
    .map((entry) => entry.path);
}

/**
 * Filters `items` by a fuzzy subsequence, preserving original order.
 */
export function filterByQuery<T>(
  items: readonly T[],
  query: string,
  haystack: (item: T) => string,
): T[] {
  if (query.length === 0) {
    return [...items];
  }
  const needle = query.toLowerCase();
  return items.filter((item) =>
    isSubsequence(haystack(item).toLowerCase(), needle),
  );
}

function matchScore(path: string, needle: string): number | undefined {
  const haystack = path.toLowerCase();
  if (!isSubsequence(haystack, needle)) {
    return undefined;
  }
  const base = basename(haystack);
  const inBase = isSubsequence(base, needle);
  const consecutive = haystack.includes(needle) ? 0 : 1;
  const basenamePenalty = inBase ? 0 : 2;
  return basenamePenalty + consecutive + path.length / 1000;
}

function isSubsequence(haystack: string, needle: string): boolean {
  let from = 0;
  for (const char of needle) {
    const at = haystack.indexOf(char, from);
    if (at === -1) {
      return false;
    }
    from = at + 1;
  }
  return true;
}

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
