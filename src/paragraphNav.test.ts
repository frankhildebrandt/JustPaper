import { describe, expect, it } from "vitest";
import { checkedParagraphNav, tickTopsPx } from "./paragraphNav";

describe("tickTopsPx", () => {
  it("centers a single tick in the view", () => {
    expect(
      tickTopsPx({
        count: 1,
        viewHeightPx: 100,
        tickHeightPx: 2,
        gapPx: 8,
        insetPx: 0,
      }),
    ).toEqual([49]);
  });

  it("keeps equal spacing and centers the cluster", () => {
    expect(
      tickTopsPx({
        count: 3,
        viewHeightPx: 100,
        tickHeightPx: 2,
        gapPx: 8,
        insetPx: 0,
      }),
    ).toEqual([39, 49, 59]);
  });

  it("compresses the gap evenly when the cluster would overflow", () => {
    expect(
      tickTopsPx({
        count: 3,
        viewHeightPx: 40,
        tickHeightPx: 2,
        gapPx: 20,
        insetPx: 4,
      }),
    ).toEqual([4, 19, 34]);
  });

  it("does not let the gap go below zero", () => {
    expect(
      tickTopsPx({
        count: 4,
        viewHeightPx: 8,
        tickHeightPx: 2,
        gapPx: 10,
        insetPx: 0,
      }),
    ).toEqual([0, 2, 4, 6]);
  });

  it("returns no ticks when there are no paragraphs", () => {
    expect(
      tickTopsPx({
        count: 0,
        viewHeightPx: 100,
        tickHeightPx: 2,
        gapPx: 8,
        insetPx: 0,
      }),
    ).toEqual([]);
  });
});

describe("checkedParagraphNav", () => {
  it("checks Absatzmarkierungen when enabled", () => {
    expect(checkedParagraphNav(true)).toEqual({ paragraphNav: true });
  });

  it("unchecks Absatzmarkierungen when disabled", () => {
    expect(checkedParagraphNav(false)).toEqual({ paragraphNav: false });
  });
});
