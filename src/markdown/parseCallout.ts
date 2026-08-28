export type CalloutFold = "none" | "open" | "closed";

export type CalloutHead = {
  rawType: string;
  type: string;
  title: string | undefined;
  fold: CalloutFold;
  /** End offset of `[!type]` / `[!type]+` within the line content. */
  markerTo: number;
};

const CALLOUT_HEAD = /^\[!([^\]]+)\]([+-])?(?:\s+(.*))?$/;

const ALIASES: Record<string, string> = {
  summary: "abstract",
  tldr: "abstract",
  hint: "tip",
  important: "tip",
  check: "success",
  done: "success",
  help: "question",
  faq: "question",
  caution: "warning",
  attention: "warning",
  fail: "failure",
  missing: "failure",
  error: "danger",
  cite: "quote",
};

const CANONICAL = new Set([
  "note",
  "abstract",
  "info",
  "todo",
  "tip",
  "success",
  "question",
  "warning",
  "failure",
  "danger",
  "bug",
  "example",
  "quote",
]);

/**
 * Maps a callout type or alias to its canonical style key.
 */
export function resolveCalloutType(raw: string): string {
  const lower = raw.toLowerCase();
  const mapped = ALIASES[lower] ?? lower;
  return CANONICAL.has(mapped) ? mapped : "note";
}

/**
 * Parses an Obsidian callout head from quote-line content (after `>`).
 */
export function parseCalloutHead(content: string): CalloutHead | undefined {
  const match = content.match(CALLOUT_HEAD);
  if (!match) {
    return undefined;
  }
  const rawType = match[1];
  const foldMark = match[2];
  const title = match[3]?.length ? match[3] : undefined;
  const fold: CalloutFold =
    foldMark === "+" ? "open" : foldMark === "-" ? "closed" : "none";
  return {
    rawType,
    type: resolveCalloutType(rawType),
    title,
    fold,
    markerTo: 2 + rawType.length + 1 + (foldMark ? 1 : 0),
  };
}
