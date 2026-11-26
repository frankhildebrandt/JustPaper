/**
 * Converts Windows separators to `/` so paths compare the same on every platform.
 */
export function normalizeFsPath(path: string): string {
  return path.replace(/\\/g, "/");
}

function trimTrailingSlashes(path: string): string {
  return path.replace(/\/+$/, "");
}

/**
 * Windows drive paths compare case-insensitively; POSIX paths stay exact.
 */
function comparable(path: string, root: string): string {
  return /^[a-z]:(?:\/|$)/i.test(root) ? path.toLowerCase() : path;
}

/**
 * Returns whether `path` is `root` itself or lies inside it.
 */
export function isUnderRoot(path: string, root: string): boolean {
  const normalizedRoot = trimTrailingSlashes(normalizeFsPath(root));
  const candidate = comparable(normalizeFsPath(path), normalizedRoot);
  const boundary = comparable(normalizedRoot, normalizedRoot);
  return candidate === boundary || candidate.startsWith(`${boundary}/`);
}

/**
 * Returns `path` relative to `root` with `/` separators, or undefined outside it.
 */
export function relativeFromRoot(root: string, path: string): string | undefined {
  const normalizedRoot = trimTrailingSlashes(normalizeFsPath(root));
  const normalizedPath = normalizeFsPath(path);
  const prefix = `${normalizedRoot}/`;
  if (
    !comparable(normalizedPath, normalizedRoot).startsWith(
      comparable(prefix, normalizedRoot),
    )
  ) {
    return undefined;
  }
  return normalizedPath.slice(prefix.length);
}

/**
 * Joins a project root and a project-relative path with `/`.
 */
export function joinRoot(root: string, relative: string): string {
  return `${trimTrailingSlashes(normalizeFsPath(root))}/${normalizeFsPath(relative).replace(/^\/+/, "")}`;
}

/**
 * Returns the parent folder of `path`, or undefined for top-level paths.
 */
export function parentDir(path: string): string | undefined {
  const trimmed = trimTrailingSlashes(normalizeFsPath(path));
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) {
    return undefined;
  }
  return trimmed.slice(0, slash);
}

/**
 * Returns whether a project-relative path names a file inside the project:
 * not absolute, not empty and never climbing above the root via `..`.
 */
export function isSafeProjectRelative(path: string): boolean {
  const normalized = normalizeFsPath(path);
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    /^[a-z]:/i.test(normalized)
  ) {
    return false;
  }
  let depth = 0;
  for (const part of normalized.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    depth += part === ".." ? -1 : 1;
    if (depth < 0) {
      return false;
    }
  }
  return depth > 0;
}
