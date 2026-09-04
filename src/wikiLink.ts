import { lineAtOffset } from "./caret";

export type WikiLink = {
  target: string;
  alias: string | undefined;
  from: number;
  to: number;
};

export type OutgoingWikiLink = {
  target: string;
  alias: string | undefined;
  path: string | undefined;
};

export type IncomingWikiLink = {
  path: string;
  line: number;
  text: string;
  target: string;
};

export type NoteContent = {
  path: string;
  content: string;
};

/**
 * Parses a `[[target]]` or `[[target|alias]]` starting at `from`.
 */
export function parseWikiLink(
  source: string,
  from: number,
): WikiLink | undefined {
  if (!source.startsWith("[[", from)) {
    return undefined;
  }
  const close = source.indexOf("]]", from + 2);
  if (close === -1) {
    return undefined;
  }
  const inner = source.slice(from + 2, close);
  if (inner.length === 0 || inner.includes("[")) {
    return undefined;
  }
  const pipe = inner.indexOf("|");
  const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
  const alias =
    pipe === -1 ? undefined : inner.slice(pipe + 1).trim() || undefined;
  if (target.length === 0) {
    return undefined;
  }
  return { target, alias, from, to: close + 2 };
}

/**
 * Returns the wiki link whose range contains `offset`.
 */
export function wikiLinkAt(
  source: string,
  offset: number,
): WikiLink | undefined {
  for (const link of wikiLinksIn(source)) {
    if (offset >= link.from && offset <= link.to) {
      return link;
    }
  }
  return undefined;
}

/**
 * Returns every wiki link in `source`.
 */
export function wikiLinksIn(source: string): WikiLink[] {
  const links: WikiLink[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf("[[", cursor);
    if (open === -1) {
      break;
    }
    const link = parseWikiLink(source, open);
    if (!link) {
      cursor = open + 2;
      continue;
    }
    links.push(link);
    cursor = link.to;
  }
  return links;
}

/**
 * Returns unique outgoing wiki targets in first-occurrence order.
 */
export function outgoingWikiLinks(
  source: string,
  files: readonly string[],
  assets: readonly string[] = [],
): OutgoingWikiLink[] {
  const seen = new Set<string>();
  const outgoing: OutgoingWikiLink[] = [];
  for (const link of wikiLinksIn(source)) {
    const key = link.target.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    outgoing.push({
      target: link.target,
      alias: link.alias,
      path: resolveWikiLink(link.target, files, assets),
    });
  }
  return outgoing;
}

/**
 * Returns wiki links in other notes that resolve to `currentRelative`.
 */
export function incomingWikiLinks(
  currentRelative: string,
  notes: readonly NoteContent[],
  files: readonly string[],
): IncomingWikiLink[] {
  const incoming: IncomingWikiLink[] = [];
  for (const note of notes) {
    if (note.path === currentRelative) {
      continue;
    }
    for (const link of wikiLinksIn(note.content)) {
      if (resolveWikiLink(link.target, files) !== currentRelative) {
        continue;
      }
      incoming.push({
        path: note.path,
        line: lineAtOffset(note.content, link.from),
        text: lineContaining(note.content, link.from),
        target: link.target,
      });
    }
  }
  return incoming;
}

function lineContaining(source: string, offset: number): string {
  const from = source.lastIndexOf("\n", Math.max(offset - 1, 0)) + 1;
  const to = source.indexOf("\n", offset);
  return source.slice(from, to === -1 ? source.length : to);
}

/**
 * Returns whether `path` is a project note (markdown, text, or Typst).
 */
export function isNotePath(path: string): boolean {
  return /\.(md|txt|typ)$/i.test(path);
}

/**
 * Returns whether a wiki target names a non-note file such as a PDF.
 */
export function isWikiAssetTarget(target: string): boolean {
  const base = basename(target);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return false;
  }
  return !isNotePath(base);
}

/**
 * Returns the project-relative path of an existing file for `target`.
 * Notes win over attachments; `[[scan]]` matches `scan.pdf` only when no note exists.
 */
export function resolveWikiLink(
  target: string,
  files: readonly string[],
  assets: readonly string[] = [],
): string | undefined {
  const note = matchWiki(target, files, wikiStem);
  if (note !== undefined) {
    return note;
  }
  const named = matchWiki(target, assets, wikiStem);
  if (named !== undefined) {
    return named;
  }
  if (isWikiAssetTarget(target)) {
    return undefined;
  }
  return matchWiki(target, assets, stripExtension);
}

function matchWiki(
  target: string,
  files: readonly string[],
  stem: (path: string) => string,
): string | undefined {
  const needle = stem(target).toLowerCase();
  if (needle.includes("/")) {
    return files.find((file) => stem(file).toLowerCase() === needle);
  }
  const matches = files.filter(
    (file) => stem(basename(file)).toLowerCase() === needle,
  );
  if (matches.length === 0) {
    return undefined;
  }
  return [...matches].sort(
    (a, b) => a.length - b.length || a.localeCompare(b),
  )[0];
}

/**
 * Returns the absolute path to create for an unresolved wiki target.
 */
export function wikiCreatePath(
  target: string,
  projectRoot: string,
  currentPath: string | null,
): string {
  const relative = withMarkdownExtension(target);
  const root = projectRoot.replace(/\/+$/, "");
  if (target.includes("/")) {
    return `${root}/${relative}`;
  }
  const dir =
    currentPath === null ? root : dirname(currentPath) || root;
  return `${dir}/${basename(relative)}`;
}

function withMarkdownExtension(target: string): string {
  if (isNotePath(target) || isWikiAssetTarget(target)) {
    return target;
  }
  return `${target}.md`;
}

function wikiStem(path: string): string {
  return path.replace(/\.(md|txt|typ)$/i, "");
}

function stripExtension(path: string): string {
  return path.replace(/\.[^./]+$/, "");
}

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function dirname(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) {
    return slash === 0 ? "/" : "";
  }
  return trimmed.slice(0, slash);
}
