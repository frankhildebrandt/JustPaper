export type StoredSession = {
  root: string | null;
  lastFile: string | null;
  carets: Record<string, number>;
};

/**
 * Reads a persisted session snapshot, ignoring corrupt storage.
 */
export function parseStoredSession(raw: string | null): StoredSession | null {
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const root = asString(record.root);
    const lastFile = asString(record.lastFile);
    if (root === null && lastFile === null && record.root !== null) {
      return null;
    }
    if (typeof record.lastFile === "number") {
      return null;
    }
    const carets = parseCarets(record.carets);
    const legacy = record.caretOffset;
    if (typeof legacy === "number" && lastFile !== null && carets[lastFile] === undefined) {
      carets[lastFile] = legacy;
    }
    return { root, lastFile, carets };
  } catch {
    return null;
  }
}

/**
 * Persists a session snapshot as a JSON string.
 */
export function serializeStoredSession(stored: StoredSession): string {
  return JSON.stringify(stored);
}

/**
 * Records the caret offset for `path`.
 */
export function rememberCaret(
  carets: Record<string, number>,
  path: string,
  offset: number,
): Record<string, number> {
  return { ...carets, [path]: offset };
}

/**
 * Returns the stored caret for `path`, or 0.
 */
export function caretFor(
  carets: Record<string, number>,
  path: string,
): number {
  return carets[path] ?? 0;
}

/**
 * Moves a stored caret from `from` to `to`.
 */
export function renameCaret(
  carets: Record<string, number>,
  from: string,
  to: string,
): Record<string, number> {
  if (!(from in carets)) {
    return carets;
  }
  const { [from]: offset, ...rest } = carets;
  return { ...rest, [to]: offset };
}

/**
 * Drops carets whose paths are not in `keep`.
 */
export function pruneCarets(
  carets: Record<string, number>,
  keep: readonly string[],
): Record<string, number> {
  const allowed = new Set(keep);
  const next: Record<string, number> = {};
  for (const [path, offset] of Object.entries(carets)) {
    if (allowed.has(path)) {
      next[path] = offset;
    }
  }
  return next;
}

/**
 * Clamps a caret offset into `[0, textLength]`.
 */
export function clampCaretOffset(offset: number, textLength: number): number {
  return Math.min(Math.max(offset, 0), textLength);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseCarets(value: unknown): Record<string, number> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const next: Record<string, number> = {};
  for (const [path, offset] of Object.entries(value)) {
    if (typeof offset === "number" && Number.isFinite(offset)) {
      next[path] = offset;
    }
  }
  return next;
}
