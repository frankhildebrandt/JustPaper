const UNTITLED = "Untitled";

/**
 * Returns the paper header label for a document path.
 */
export function displayName(path: string | null): string {
  if (path === null) {
    return UNTITLED;
  }
  const name = basename(path);
  if (name.toLowerCase().endsWith(".md")) {
    return name.slice(0, -3);
  }
  if (name.toLowerCase().endsWith(".typ")) {
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
  templatePath = "note.md",
): string | undefined {
  const next = nextFileName(templatePath, nextDisplayName.trim());
  if (next === undefined) {
    return undefined;
  }
  const root = normalizePath(projectRoot).replace(/\/+$/, "");
  return `${root}/${next}`;
}

function nextFileName(
  currentPath: string,
  typed: string,
): string | undefined {
  if (!isValidBaseName(typed)) {
    return undefined;
  }
  if (hasFileExtension(typed)) {
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

const FILE_EXTENSION = /^[a-z0-9]{1,5}$/i;
const HAS_LETTER = /[a-z]/i;

/**
 * Returns whether `name` ends in a plausible file extension: one to five
 * alphanumeric characters with at least one letter after the last dot.
 * Dotted names such as "v1.2", "Dr. Smith" or "Meeting 2024.05.01" do not.
 */
export function hasFileExtension(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return false;
  }
  const suffix = name.slice(dot + 1);
  return FILE_EXTENSION.test(suffix) && HAS_LETTER.test(suffix);
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
  const parts = normalizePath(path).split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/**
 * Returns the parent directory of a file path.
 */
export function dirname(path: string): string {
  const trimmed = normalizePath(path).replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) {
    return slash === 0 ? "/" : "";
  }
  return trimmed.slice(0, slash);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}
