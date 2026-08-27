import { describe, expect, it } from "vitest";
import { verticalOriginPaddingPx } from "./pageLayout";
import { checkedViewModeItems, verticalPaddingPx } from "./viewMode";

describe("verticalPaddingPx", () => {
  it("insets the first line enough for the filename above it", () => {
    expect(verticalPaddingPx("normal", 800, 16)).toEqual({ top: 32, bottom: 0 });
  });

  it("pads both ends so the first line can sit on the vertical center", () => {
    const originPx = verticalOriginPaddingPx(800, 16);

    expect(originPx).toBe(392);
    expect(verticalPaddingPx("typewriter", 800, 16)).toEqual({
      top: originPx,
      bottom: originPx,
    });
  });
});

describe("checkedViewModeItems", () => {
  it("checks only Normal", () => {
    expect(checkedViewModeItems("normal")).toEqual({
      normal: true,
      typewriter: false,
    });
  });

  it("checks only Schreibmaschine", () => {
    expect(checkedViewModeItems("typewriter")).toEqual({
      normal: false,
      typewriter: true,
    });
  });
});
