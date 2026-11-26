import { describe, expect, it, vi } from "vitest";
import { POINTER_GESTURE_END_EVENTS, onGestureEnd } from "./pointerGestureEnd";

describe("onGestureEnd", () => {
  it("ends a pointer gesture on mouseup, drag end, drop, pointer cancel and blur", () => {
    expect(POINTER_GESTURE_END_EVENTS.map((entry) => entry.type)).toEqual([
      "mouseup",
      "dragend",
      "drop",
      "pointercancel",
      "blur",
    ]);
  });

  it.each(["dragend", "drop", "pointercancel"])(
    "fires once on %s and then detaches every listener",
    (type) => {
      const target = new EventTarget();
      const end = vi.fn();
      onGestureEnd(target, end);

      target.dispatchEvent(new Event(type));
      target.dispatchEvent(new Event("mouseup"));

      expect(end).toHaveBeenCalledTimes(1);
    },
  );

  it("detaches without firing when cancelled", () => {
    const target = new EventTarget();
    const end = vi.fn();
    const cancel = onGestureEnd(target, end);

    cancel();
    target.dispatchEvent(new Event("mouseup"));

    expect(end).not.toHaveBeenCalled();
  });
});
