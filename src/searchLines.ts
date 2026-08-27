const SEARCH_LIMIT = 200;

export type LineHit = {
  line: number;
  text: string;
};

/**
 * Returns 1-based line hits for a case-insensitive substring query.
 */
export function searchLines(text: string, query: string): LineHit[] {
  if (query.trim().length === 0) {
    return [];
  }
  const needle = query.toLowerCase();
  const hits: LineHit[] = [];
  let line = 1;
  for (const textLine of text.split("\n")) {
    if (hits.length >= SEARCH_LIMIT) {
      break;
    }
    if (textLine.toLowerCase().includes(needle)) {
      hits.push({ line, text: textLine });
    }
    line += 1;
  }
  return hits;
}
