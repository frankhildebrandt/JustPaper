export const RECENT_FILES_LIMIT = 9;

/**
 * Prepends `path` as the most recently used file, capped at nine entries.
 */
export function rememberRecent(paths: string[], path: string): string[] {
  return [path, ...paths.filter((entry) => entry !== path)].slice(
    0,
    RECENT_FILES_LIMIT,
  );
}

/**
 * Removes `path` from the recent list, e.g. after a missing-file error.
 */
export function forgetRecent(paths: string[], path: string): string[] {
  return paths.filter((entry) => entry !== path);
}

/**
 * Reads a persisted recent-files payload, ignoring corrupt storage.
 */
export function parseRecentFiles(raw: string | null): string[] {
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry) => typeof entry === "string");
  } catch {
    return [];
  }
}

/**
 * Persists a recent-files list as a JSON string.
 */
export function serializeRecentFiles(paths: string[]): string {
  return JSON.stringify(paths);
}

/**
 * Returns menu labels for recent paths. Shared file names include the parent folder.
 */
export function recentFileLabels(paths: string[]): string[] {
  const names = paths.map(fileName);
  const counts = new Map<string, number>();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return paths.map((path, index) => {
    const name = names[index] ?? path;
    if ((counts.get(name) ?? 0) < 2) {
      return name;
    }
    const parent = parentFolder(path);
    return parent ? `${name} — ${parent}` : name;
  });
}

function fileName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function parentFolder(path: string): string | undefined {
  const parts = path.split("/").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}
