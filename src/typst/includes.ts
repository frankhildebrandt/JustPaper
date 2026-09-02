import { lineAtOffset } from "../caret";
import { parseTypst, type HashSpan, type InlineSpan } from "./parse";

export type TypstInclude = {
  path: string;
  from: number;
  to: number;
};

export type OutgoingTypstInclude = {
  target: string;
  path: string | undefined;
};

export type IncomingTypstInclude = {
  path: string;
  line: number;
  text: string;
  target: string;
};

export type NoteContent = {
  path: string;
  content: string;
};

const INCLUDE_PATH =
  /^#include\s*(?:\(\s*)?"([^"]+)"/;

/**
 * Returns every `#include` path in Typst markup, in source order.
 */
export function typstIncludesIn(source: string): TypstInclude[] {
  const includes: TypstInclude[] = [];
  for (const span of hashSpansIn(source)) {
    const path = includePathFromHash(source, span);
    if (path === undefined) {
      continue;
    }
    includes.push({ path, from: span.from, to: span.to });
  }
  return includes;
}

/**
 * Returns the include whose range contains `offset`.
 */
export function typstIncludeAt(
  source: string,
  offset: number,
): TypstInclude | undefined {
  for (const include of typstIncludesIn(source)) {
    if (offset >= include.from && offset <= include.to) {
      return include;
    }
  }
  return undefined;
}

/**
 * Resolves an include path relative to the including file, or undefined if it
 * leaves the project root.
 */
export function resolveTypstInclude(
  fromRelative: string,
  includePath: string,
): string | undefined {
  const trimmed = includePath.replace(/\\/g, "/").trim();
  if (trimmed.length === 0 || trimmed.startsWith("/") || isWindowsAbsolute(trimmed)) {
    return undefined;
  }
  const fromDir = posixDirname(fromRelative);
  const joined = fromDir === "" ? trimmed : `${fromDir}/${trimmed}`;
  return normalizeProjectPath(joined);
}

/**
 * Walks `#include` edges depth-first from `mainRelative`.
 * Missing files are listed but not followed. Cycles are skipped.
 */
export async function collectTypstProjectFiles(
  mainRelative: string,
  readContent: (relativePath: string) => Promise<string | undefined>,
): Promise<string[]> {
  const files: string[] = [];
  const visited = new Set<string>();

  const visit = async (relative: string): Promise<void> => {
    if (visited.has(relative)) {
      return;
    }
    visited.add(relative);
    files.push(relative);
    const content = await readContent(relative);
    if (content === undefined) {
      return;
    }
    for (const include of typstIncludesIn(content)) {
      const resolved = resolveTypstInclude(relative, include.path);
      if (resolved !== undefined) {
        await visit(resolved);
      }
    }
  };

  await visit(mainRelative);
  return files;
}

/**
 * Returns unique outgoing includes in first-occurrence order.
 */
export function outgoingTypstIncludes(
  source: string,
  fromRelative: string,
): OutgoingTypstInclude[] {
  const seen = new Set<string>();
  const outgoing: OutgoingTypstInclude[] = [];
  for (const include of typstIncludesIn(source)) {
    const resolved = resolveTypstInclude(fromRelative, include.path);
    const key = (resolved ?? include.path).toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    outgoing.push({ target: include.path, path: resolved });
  }
  return outgoing;
}

/**
 * Returns includes in other notes that resolve to `currentRelative`.
 */
export function incomingTypstIncludes(
  currentRelative: string,
  notes: readonly NoteContent[],
): IncomingTypstInclude[] {
  const incoming: IncomingTypstInclude[] = [];
  for (const note of notes) {
    if (note.path === currentRelative) {
      continue;
    }
    for (const include of typstIncludesIn(note.content)) {
      if (resolveTypstInclude(note.path, include.path) !== currentRelative) {
        continue;
      }
      incoming.push({
        path: note.path,
        line: lineAtOffset(note.content, include.from),
        text: lineContaining(note.content, include.from),
        target: include.path,
      });
    }
  }
  return incoming;
}

/**
 * Appends `#include "path"` for `includeRelative` unless the main file already
 * includes it. `fromRelative` is the main document's project-relative path.
 */
export function appendTypstInclude(
  source: string,
  fromRelative: string,
  includeRelative: string,
): string {
  const already = typstIncludesIn(source).some(
    (include) => resolveTypstInclude(fromRelative, include.path) === includeRelative,
  );
  if (already) {
    return source;
  }
  const arg = relativeTypstIncludePath(fromRelative, includeRelative);
  if (arg === undefined) {
    return source;
  }
  const line = `#include "${arg}"`;
  if (source.length === 0) {
    return `${line}\n`;
  }
  if (source.endsWith("\n")) {
    return `${source}${line}\n`;
  }
  return `${source}\n${line}\n`;
}

/**
 * Returns the include argument from `fromRelative` to `toRelative`.
 */
export function relativeTypstIncludePath(
  fromRelative: string,
  toRelative: string,
): string | undefined {
  const fromDir = posixDirname(fromRelative);
  const fromParts = fromDir === "" ? [] : fromDir.split("/");
  const toParts = toRelative.split("/").filter(Boolean);
  const toFile = toParts.pop();
  if (toFile === undefined) {
    return undefined;
  }
  let shared = 0;
  while (
    shared < fromParts.length &&
    shared < toParts.length &&
    fromParts[shared] === toParts[shared]
  ) {
    shared += 1;
  }
  const ups = fromParts.length - shared;
  const downs = toParts.slice(shared);
  return [...Array<string>(ups).fill(".."), ...downs, toFile].join("/");
}

function includePathFromHash(source: string, span: HashSpan): string | undefined {
  const code = source.slice(span.code.from, span.code.to);
  const match = INCLUDE_PATH.exec(code);
  return match?.[1];
}

function hashSpansIn(source: string): HashSpan[] {
  const spans: HashSpan[] = [];
  const walk = (items: readonly InlineSpan[]): void => {
    for (const span of items) {
      if (span.kind === "hash") {
        spans.push(span);
        walk(span.children);
      } else if (span.kind === "strong" || span.kind === "em") {
        walk(span.children);
      }
    }
  };
  for (const block of parseTypst(source)) {
    if (block.kind === "codeblock") {
      continue;
    }
    walk(block.children);
  }
  return spans;
}

function posixDirname(relative: string): string {
  const slash = relative.lastIndexOf("/");
  if (slash <= 0) {
    return "";
  }
  return relative.slice(0, slash);
}

function normalizeProjectPath(path: string): string | undefined {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (parts.length === 0) {
        return undefined;
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join("/");
}

function isWindowsAbsolute(path: string): boolean {
  return /^[A-Za-z]:/.test(path);
}

function lineContaining(source: string, offset: number): string {
  const from = source.lastIndexOf("\n", Math.max(offset - 1, 0)) + 1;
  const to = source.indexOf("\n", offset);
  return source.slice(from, to === -1 ? source.length : to);
}
