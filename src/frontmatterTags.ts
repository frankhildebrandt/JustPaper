import { parseFrontmatter } from "./markdown/parseFrontmatter";

const FENCE = "---";
const TAG_KEY = /^(tags|tag):\s*(.*)$/;
const LIST_ITEM = /^\s*-\s+(.*)$/;

/**
 * Returns unique frontmatter tags in first-seen order from a YAML fence at offset 0.
 */
export function extractFrontmatterTags(source: string): string[] {
  const range = parseFrontmatter(source, 0);
  if (range === undefined) {
    return [];
  }
  const afterOpen = FENCE.length;
  const bodyStart =
    afterOpen < source.length && source[afterOpen] === "\n"
      ? afterOpen + 1
      : afterOpen;
  const closeAt = source.indexOf(`\n${FENCE}`, bodyStart - 1);
  if (closeAt === -1) {
    return [];
  }
  return unique(collectTags(source.slice(bodyStart, closeAt)));
}

function collectTags(body: string): string[] {
  const tags: string[] = [];
  const lines = body.split("\n");
  let index = 0;
  while (index < lines.length) {
    const match = TAG_KEY.exec(lines[index] ?? "");
    if (!match) {
      index += 1;
      continue;
    }
    const rest = (match[2] ?? "").trim();
    if (rest.startsWith("[")) {
      tags.push(...parseFlowSequence(rest));
      index += 1;
      continue;
    }
    if (rest.length > 0) {
      const tag = normalizeTag(rest);
      if (tag !== undefined) {
        tags.push(tag);
      }
      index += 1;
      continue;
    }
    index += 1;
    while (index < lines.length) {
      const line = lines[index] ?? "";
      if (line.trim().length === 0) {
        index += 1;
        continue;
      }
      if ((line.match(/^\s*/)?.[0].length ?? 0) === 0) {
        break;
      }
      const item = LIST_ITEM.exec(line);
      if (!item) {
        break;
      }
      const tag = normalizeTag(item[1] ?? "");
      if (tag !== undefined) {
        tags.push(tag);
      }
      index += 1;
    }
  }
  return tags;
}

function parseFlowSequence(raw: string): string[] {
  const close = raw.lastIndexOf("]");
  if (close < 1) {
    return [];
  }
  const inner = raw.slice(1, close);
  if (inner.trim().length === 0) {
    return [];
  }
  const tags: string[] = [];
  for (const item of splitFlowItems(inner)) {
    const tag = normalizeTag(item);
    if (tag !== undefined) {
      tags.push(tag);
    }
  }
  return tags;
}

function splitFlowItems(inner: string): string[] {
  const items: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  for (const char of inner) {
    if (quote !== undefined) {
      current += char;
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      items.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  items.push(current);
  return items;
}

/**
 * Strips quotes, an unquoted trailing comment, and one leading hash.
 */
function normalizeTag(raw: string): string | undefined {
  let value = raw.trim();
  if (value.length === 0) {
    return undefined;
  }
  const quoted =
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2);
  if (quoted) {
    value = value.slice(1, -1);
  } else {
    const comment = value.indexOf(" #");
    if (comment !== -1) {
      value = value.slice(0, comment).trim();
    }
  }
  if (value.startsWith("#")) {
    value = value.slice(1);
  }
  value = value.trim();
  return value.length === 0 ? undefined : value;
}

function unique(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    if (seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    out.push(tag);
  }
  return out;
}
