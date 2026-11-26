/**
 * Returns whether a rename only changes letter case, which case-insensitive
 * file systems (default macOS/Windows) report as "already exists".
 */
export function isCaseOnlyRename(from: string, to: string): boolean {
  return from !== to && from.toLowerCase() === to.toLowerCase();
}
