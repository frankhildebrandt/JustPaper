export type NoteTags = {
  path: string;
  tags?: readonly string[];
};

export type NoteMatch = {
  path: string;
  matchedTags: string[];
};

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
 * Returns tags whose names contain the query as a subsequence.
 */
export function matchingTags(
  tags: readonly string[],
  query: string,
): string[] {
  if (query.length === 0) {
    return [];
  }
  const needle = tagNeedle(query);
  if (needle.length === 0) {
    return [];
  }
  return tags.filter((tag) => isSubsequence(tag.toLowerCase(), needle));
}

/**
 * Filters notes by path or tag, attaching only the tags that matched the query.
 */
export function fuzzyMatchNotes(
  files: readonly NoteTags[],
  query: string,
): NoteMatch[] {
  if (query.length === 0) {
    return files.map((file) => ({ path: file.path, matchedTags: [] }));
  }
  const needle = query.toLowerCase();
  const pathHits: { path: string; matchedTags: string[]; score: number }[] =
    [];
  const tagHits: NoteMatch[] = [];
  for (const file of files) {
    const matchedTags = matchingTags(file.tags ?? [], query);
    const score = matchScore(file.path, needle);
    if (score !== undefined) {
      pathHits.push({ path: file.path, matchedTags, score });
      continue;
    }
    if (matchedTags.length > 0) {
      tagHits.push({ path: file.path, matchedTags });
    }
  }
  pathHits.sort((a, b) => a.score - b.score || a.path.localeCompare(b.path));
  tagHits.sort((a, b) => a.path.localeCompare(b.path));
  return [
    ...pathHits.map(({ path, matchedTags }) => ({ path, matchedTags })),
    ...tagHits,
  ];
}

function tagNeedle(query: string): string {
  const needle = query.toLowerCase();
  return needle.startsWith("#") ? needle.slice(1) : needle;
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
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
