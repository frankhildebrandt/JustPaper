/**
 * Returns the directory of a document path, or null when unsaved.
 */
export function documentDir(path: string | null): string | null {
  if (path === null) {
    return null;
  }
  const trimmed = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) {
    return slash === 0 ? "/" : null;
  }
  return trimmed.slice(0, slash);
}

/**
 * Resolves a markdown image href to an http(s) URL or a filesystem path.
 * Remote http(s) sources require `allowExternal`.
 */
export function resolveImageSrc(
  href: string,
  baseDir: string | null,
  allowExternal = false,
): string | undefined {
  const trimmed = href.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const normalized = trimmed.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("file:")) {
    return undefined;
  }
  if (lower.startsWith("https://") || lower.startsWith("http://")) {
    return allowExternal ? normalized : undefined;
  }
  if (normalized.startsWith("/") || /^[a-z]:/i.test(normalized)) {
    return normalizePath(normalized);
  }
  if (baseDir === null || baseDir.length === 0) {
    return undefined;
  }
  return joinPath(baseDir.replace(/\\/g, "/"), normalized);
}

function joinPath(baseDir: string, relative: string): string {
  const prefix = absolutePrefix(baseDir);
  const parts = [
    ...baseDir.split("/").filter((part) => part.length > 0),
    ...relative.split("/"),
  ];
  return prefix + normalizeParts(parts).join("/");
}

function normalizePath(path: string): string {
  const prefix = absolutePrefix(path);
  return prefix + normalizeParts(path.split("/")).join("/");
}

function absolutePrefix(path: string): string {
  return path.startsWith("//") ? "//" : path.startsWith("/") ? "/" : "";
}

function normalizeParts(parts: string[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out;
}
