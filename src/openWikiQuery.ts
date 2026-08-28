export type OpenWikiQuery = {
  from: number;
  query: string;
};

/**
 * Finds an incomplete `[[query` whose open brackets sit at or before `caret`.
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
  const close = source.indexOf("]]", open + 2);
  if (close !== -1 && caret <= close + 2) {
    return undefined;
  }
  const inner = before.slice(open + 2);
  if (inner.includes("[") || inner.includes("|")) {
    return undefined;
  }
  return { from: open, query: inner };
}

/**
 * Returns the wiki target to insert for a project-relative file path.
 */
export function wikiInsertTarget(path: string): string {
  return path.replace(/\.(md|txt)$/i, "");
}

/**
 * Returns a completed wiki-link markdown for `target`.
 */
export function completedWikiLink(target: string): string {
  return `[[${target}]]`;
}
