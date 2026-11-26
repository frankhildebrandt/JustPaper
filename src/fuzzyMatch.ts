const WORD_SEPARATOR = /[\s\-_./\\]/;

export type NoteTags = {
  path: string;
  tags?: readonly string[];
};

export type NoteMatch = {
  path: string;
  matchedTags: string[];
};

/**
 * Filters and ranks project-relative paths by a fuzzy query. Every
 * whitespace-separated token must match as a subsequence; basename,
 * basename-prefix and word-start hits rank first.
 */
export function fuzzyMatch(
  files: readonly string[],
  query: string,
): string[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) {
    return [...files];
  }
  const scored: { path: string; score: number }[] = [];
  for (const path of files) {
    const score = matchScore(path, tokens);
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
 * Paths are ranked like `fuzzyMatch`.
 */
export function fuzzyMatchNotes(
  files: readonly NoteTags[],
  query: string,
): NoteMatch[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) {
    return files.map((file) => ({ path: file.path, matchedTags: [] }));
  }
  const pathHits: { path: string; matchedTags: string[]; score: number }[] =
    [];
  const tagHits: NoteMatch[] = [];
  for (const file of files) {
    const matchedTags = matchingTags(file.tags ?? [], query);
    const score = matchScore(file.path, tokens);
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
 * Filters `items` by fuzzy subsequence tokens, preserving original order.
 */
export function filterByQuery<T>(
  items: readonly T[],
  query: string,
  haystack: (item: T) => string,
): T[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) {
    return [...items];
  }
  return items.filter((item) => {
    const text = haystack(item).toLowerCase();
    return tokens.every((token) => isSubsequence(text, token));
  });
}

function queryTokens(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Returns a rank for `path` (lower is better), or undefined if any token
 * misses.
 */
function matchScore(path: string, tokens: readonly string[]): number | undefined {
  const haystack = path.toLowerCase();
  let score = path.length / 1000;
  for (const token of tokens) {
    const tokenScore = tokenMatchScore(haystack, token);
    if (tokenScore === undefined) {
      return undefined;
    }
    score += tokenScore;
  }
  return score;
}

function tokenMatchScore(haystack: string, token: string): number | undefined {
  if (!isSubsequence(haystack, token)) {
    return undefined;
  }
  const base = basename(haystack);
  const basenamePenalty = isSubsequence(base, token) ? 0 : 2;
  const consecutive = haystack.includes(token) ? 0 : 1;
  return basenamePenalty + consecutive + wordStartPenalty(haystack, base, token);
}

/**
 * Prefers a basename prefix, then a hit at a word start, over an inner hit.
 */
function wordStartPenalty(haystack: string, base: string, token: string): number {
  if (base.startsWith(token)) {
    return 0;
  }
  return occursAtWordStart(haystack, token) ? 0.5 : 1;
}

function occursAtWordStart(haystack: string, token: string): boolean {
  let at = haystack.indexOf(token);
  while (at !== -1) {
    if (at === 0 || WORD_SEPARATOR.test(haystack[at - 1])) {
      return true;
    }
    at = haystack.indexOf(token, at + 1);
  }
  return false;
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
