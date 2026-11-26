import { noteStem } from "./wikiLink";

export type OpenWikiQuery = {
  from: number;
  query: string;
};

/**
 * Finds an incomplete `[[query` whose open brackets sit at or before `caret`.
 * The query stays on one line and is closed only by a `]]` on the same line
 * before the next `[[`.
 */
export function openWikiQuery(
  source: string,
  caret: number,
): OpenWikiQuery | undefined {
  const before = source.slice(0, caret);
  const open = before.lastIndexOf("[[");
  if (open === -1 || caret < open + 2) {
    return undefined;
  }
  const inner = before.slice(open + 2);
  if (/[[\]|\n]/.test(inner)) {
    return undefined;
  }
  if (isClosedAtCaret(source, open + 2, caret)) {
    return undefined;
  }
  return { from: open, query: inner };
}

/**
 * Returns whether the link opened before `innerFrom` already closes at or
 * after `caret` on the same line and before any further `[[`.
 */
function isClosedAtCaret(
  source: string,
  innerFrom: number,
  caret: number,
): boolean {
  const close = source.indexOf("]]", innerFrom);
  if (close === -1 || caret > close + 2) {
    return false;
  }
  const between = source.slice(innerFrom, close);
  return !between.includes("\n") && !between.includes("[[");
}

/**
 * Returns the wiki target to insert for a project-relative file path.
 */
export function wikiInsertTarget(path: string): string {
  return noteStem(path);
}

/**
 * Returns a completed wiki-link markdown for `target`.
 */
export function completedWikiLink(target: string): string {
  return `[[${target}]]`;
}
