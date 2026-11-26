/**
 * Events that end a pointer selection gesture. Bubbling events are captured so
 * widgets that stop propagation cannot swallow them; `blur` only listens to the
 * window itself, because captured element blurs fire on every focus change.
 */
export const POINTER_GESTURE_END_EVENTS: ReadonlyArray<{
  type: string;
  capture: boolean;
}> = [
  { type: "mouseup", capture: true },
  { type: "dragend", capture: true },
  { type: "drop", capture: true },
  { type: "pointercancel", capture: true },
  { type: "blur", capture: false },
];

/**
 * Calls `end` once on the first gesture-ending event on `target` and detaches
 * all listeners. The returned function detaches them without calling `end`.
 */
export function onGestureEnd(target: EventTarget, end: () => void): () => void {
  const detach = (): void => {
    for (const { type, capture } of POINTER_GESTURE_END_EVENTS) {
      target.removeEventListener(type, finish, capture);
    }
  };
  const finish = (): void => {
    detach();
    end();
  };
  for (const { type, capture } of POINTER_GESTURE_END_EVENTS) {
    target.addEventListener(type, finish, capture);
  }
  return detach;
}
