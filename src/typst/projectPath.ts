import { joinRoot } from "../projectPath";

/**
 * Normalizes a slash-separated project-relative path, or returns undefined
 * when it is empty or leaves the project root via "..".
 */
export function normalizeProjectPath(path: string): string | undefined {
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

/**
 * Returns whether a Typst path argument starts at the project root ("/…").
 */
export function isProjectRootPath(path: string): boolean {
  return path.replace(/\\/g, "/").startsWith("/");
}

/**
 * Returns the image href to display for a Typst `#image` path. A leading "/"
 * means the project root and becomes an absolute path under `projectRoot`;
 * escapes return undefined. Other hrefs, or an unknown root, pass through.
 */
export function typstImageHref(
  src: string,
  projectRoot: string | undefined,
): string | undefined {
  if (projectRoot === undefined || !isProjectRootPath(src)) {
    return src;
  }
  const relative = normalizeProjectPath(src.replace(/\\/g, "/"));
  if (relative === undefined) {
    return undefined;
  }
  return joinRoot(projectRoot, relative);
}
