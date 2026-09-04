import { describe, expect, it } from "vitest";
import {
  checkedHighlightModeItems,
  highlightPaintMode,
  highlightSuspendedAfterGesture,
} from "./highlightMode";

describe("checkedHighlightModeItems", () => {
  it("checks only Kein Highlight", () => {
    expect(checkedHighlightModeItems("none")).toEqual({
      none: true,
      paragraph: false,
      sentence: false,
      headline: false,
    });
  });

  it("checks only Absatz", () => {
    expect(checkedHighlightModeItems("paragraph")).toEqual({
      none: false,
      paragraph: true,
      sentence: false,
      headline: false,
    });
  });

  it("checks only Satz", () => {
    expect(checkedHighlightModeItems("sentence")).toEqual({
      none: false,
      paragraph: false,
      sentence: true,
      headline: false,
    });
  });

  it("checks only Headline", () => {
    expect(checkedHighlightModeItems("headline")).toEqual({
      none: false,
      paragraph: false,
      sentence: false,
      headline: true,
    });
  });
});

describe("highlightSuspendedAfterGesture", () => {
  it("suspends on wheel and stays suspended", () => {
    expect(highlightSuspendedAfterGesture(false, { type: "wheel" })).toBe(true);
    expect(highlightSuspendedAfterGesture(true, { type: "wheel" })).toBe(true);
  });

  it("resumes on click", () => {
    expect(highlightSuspendedAfterGesture(true, { type: "click" })).toBe(false);
  });

  it("resumes on keyboard input", () => {
    expect(
      highlightSuspendedAfterGesture(true, { type: "keydown", key: "a" }),
    ).toBe(false);
    expect(
      highlightSuspendedAfterGesture(true, {
        type: "keydown",
        key: "ArrowDown",
      }),
    ).toBe(false);
  });

  it("does not resume on modifier keys", () => {
    expect(
      highlightSuspendedAfterGesture(true, { type: "keydown", key: "Shift" }),
    ).toBe(true);
  });
});

describe("highlightPaintMode", () => {
  it("paints none while suspended", () => {
    expect(highlightPaintMode("paragraph", true)).toBe("none");
    expect(highlightPaintMode("sentence", false)).toBe("sentence");
    expect(highlightPaintMode("none", true)).toBe("none");
  });
});
