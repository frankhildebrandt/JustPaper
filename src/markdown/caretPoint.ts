export type NativeCaretPos = {
  node: Node;
  offset: number;
};

type DocumentCaretApis = Document & {
  caretRangeFromPoint?(x: number, y: number): Range | null;
  caretPositionFromPoint?(
    x: number,
    y: number,
  ): { offsetNode: Node; offset: number } | null;
};

/**
 * Best-effort native caret under a client point (WebKit Range / Firefox Position).
 */
export function nativeCaretFromPoint(
  clientX: number,
  clientY: number,
): NativeCaretPos | null {
  const doc = document as DocumentCaretApis;
  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(clientX, clientY);
    if (range) {
      return { node: range.startContainer, offset: range.startOffset };
    }
  }
  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(clientX, clientY);
    if (pos) {
      return { node: pos.offsetNode, offset: pos.offset };
    }
  }
  return null;
}
