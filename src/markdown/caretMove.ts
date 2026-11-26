import type { TransactionSpec } from "@codemirror/state";
import { setGoalColumn } from "./goalColumn";

/**
 * Transaction for a keyboard caret move to `head`: scrolls it into view, is
 * tagged as a "select" user event and, for vertical moves, keeps `goalX`.
 */
export function caretMoveSpec(head: number, goalX?: number): TransactionSpec {
  return {
    selection: { anchor: head },
    scrollIntoView: true,
    userEvent: "select",
    effects: goalX === undefined ? [] : setGoalColumn.of(goalX),
  };
}

/**
 * Maps a screen arrow direction (1 = right) onto document order; in
 * right-to-left text the right arrow moves backwards.
 */
export function logicalDirection(direction: 1 | -1, rtl: boolean): 1 | -1 {
  return rtl ? (-direction as 1 | -1) : direction;
}
