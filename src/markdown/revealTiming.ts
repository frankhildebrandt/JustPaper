/**
 * Whether caret-driven mark/widget reveal may rebuild decorations.
 * Deferred while the primary pointer is down so click coordinates stay stable
 * against the layout the user actually clicked.
 */
export function allowCaretReveal(
  showMarks: boolean,
  pointerSelecting: boolean,
): boolean {
  return showMarks && !pointerSelecting;
}

/**
 * Selection to re-assert when contenteditable/WebKit drifts during a click.
 * Returns null when the gesture has no stored pointer head.
 */
export function pointerSnapSelection(
  pointerAnchor: number | null,
  pointerHead: number | null,
): { anchor: number; head: number } | null {
  if (pointerHead === null) {
    return null;
  }
  return { anchor: pointerAnchor ?? pointerHead, head: pointerHead };
}

/**
 * Whether a post-click selection lock should still re-assert `snap`.
 * Covers the window where mark-reveal mutates the DOM and WebKit reports a
 * stale contenteditable caret.
 */
export function selectionLockHolds(
  lockedUntilMs: number,
  nowMs: number,
): boolean {
  return nowMs < lockedUntilMs;
}
