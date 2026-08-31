const UNTITLED = "Untitled";

/**
 * Returns the paper header label for a document path.
 */
export function displayName(path: string | null): string {
  if (path === null) {
    return UNTITLED;
  }
  const name = basename(path);
  if (name.endsWith(".md")) {
    return name.slice(0, -3);
  }
  if (name.endsWith(".typ")) {
    return name.slice(0, -4);
  }
  return name;
}

/**
 * Returns the destination path after renaming from the header, or undefined if invalid.
 */
export function renamePath(
  currentPath: string,
  nextDisplayName: string,
): string | undefined {
  const next = nextFileName(currentPath, nextDisplayName.trim());
  if (next === undefined) {
    return undefined;
  }
  const parent = dirname(currentPath);
  return parent === "" ? next : `${parent}/${next}`;
}

/**
 * Returns the path for a first save of an untitled note into a project root.
 */
export function untitledCreatePath(
  projectRoot: string,
  nextDisplayName: string,
): string | undefined {
  const next = nextFileName("note.md", nextDisplayName.trim());
  if (next === undefined) {
    return undefined;
  }
  const root = projectRoot.replace(/\/+$/, "");
  return `${root}/${next}`;
}

function nextFileName(
  currentPath: string,
  typed: string,
): string | undefined {
  if (!isValidBaseName(typed)) {
    return undefined;
  }
  if (hasExtension(typed)) {
    return typed;
  }
  return `${typed}${extensionOf(currentPath)}`;
}

function isValidBaseName(name: string): boolean {
  if (name.length === 0) {
    return false;
  }
  if (name === "." || name === "..") {
    return false;
  }
  return !name.includes("/") && !name.includes("\\");
}

function hasExtension(name: string): boolean {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1;
}

function extensionOf(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return name.slice(dot);
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
