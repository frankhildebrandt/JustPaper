export type LineEnding = "\n" | "\r\n";

/**
 * Returns the line ending a file uses; files without CRLF count as LF.
 */
export function detectLineEnding(text: string): LineEnding {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * Normalises CRLF and lone CR to LF, the form the editor works with.
 */
export function toLf(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/**
 * Converts LF editor text back to the file's original line ending.
 */
export function withLineEnding(text: string, lineEnding: LineEnding): string {
  return lineEnding === "\n" ? text : text.replace(/\n/g, lineEnding);
}
