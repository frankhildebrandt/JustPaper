import { parseTodo, type TodoToggle } from "./parseTodo";

/**
 * Change that flips the task box of the line `[lineFrom, lineTo)`, if that
 * line is a GFM task (`- [ ]` / `- [x]`).
 */
export function todoToggleOnLine(
  source: string,
  lineFrom: number,
  lineTo: number,
): TodoToggle | undefined {
  const todo = parseTodo(source, lineFrom, lineTo);
  if (!todo) {
    return undefined;
  }
  return {
    from: todo.box.from + 1,
    to: todo.box.from + 2,
    insert: todo.checked ? " " : "x",
  };
}

/**
 * True for a primary-button click that is not a macOS ctrl-click (which opens
 * the context menu).
 */
export function isPrimaryClick(
  event: Pick<MouseEvent, "button" | "ctrlKey">,
  mac: boolean = isMacPlatform(),
): boolean {
  return event.button === 0 && !(mac && event.ctrlKey);
}

function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
}
