import { describe, expect, it } from "vitest";
import { allowCaretReveal, pointerSnapSelection, selectionLockHolds } from "./revealTiming";

describe("selectionLockHolds", () => {
  it("holds until the deadline and releases after", () => {
    expect(selectionLockHolds(100, 99)).toBe(true);
    expect(selectionLockHolds(100, 100)).toBe(false);
    expect(selectionLockHolds(100, 150)).toBe(false);
  });
});

describe("allowCaretReveal", () => {
  it("allows reveal in edit mode when the pointer is up", () => {
    expect(allowCaretReveal(true, false)).toBe(true);
  });

  it("defers reveal while the primary pointer is selecting", () => {
    expect(allowCaretReveal(true, true)).toBe(false);
  });

  it("never reveals caret marks in view mode", () => {
    expect(allowCaretReveal(false, false)).toBe(false);
    expect(allowCaretReveal(false, true)).toBe(false);
  });
});

describe("pointerSnapSelection", () => {
  it("returns null without a pointer head", () => {
    expect(pointerSnapSelection(10, null)).toBeNull();
  });

  it("uses head as anchor when only head is set", () => {
    expect(pointerSnapSelection(null, 42)).toEqual({ anchor: 42, head: 42 });
  });

  it("keeps an explicit drag anchor", () => {
    expect(pointerSnapSelection(10, 42)).toEqual({ anchor: 10, head: 42 });
  });
});
