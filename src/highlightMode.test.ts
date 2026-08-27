import { describe, expect, it } from "vitest";
import { checkedHighlightModeItems } from "./highlightMode";

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
