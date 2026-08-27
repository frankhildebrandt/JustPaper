import { describe, expect, it } from "vitest";
import {
  LINE_CAPACITY,
  contentWidthPx,
  fontSizeForLineCapacity,
  scrollTopToCenterLine,
  verticalOriginPaddingPx,
} from "./pageLayout";
import { fontSizeScale } from "./settings";

describe("fontSizeForLineCapacity", () => {
  it("fits exactly LINE_CAPACITY glyphs into the available width", () => {
    const availableWidthPx = 390;
    const charWidthAt1px = 0.6;

    const fontSizePx = fontSizeForLineCapacity(availableWidthPx, charWidthAt1px);

    expect(LINE_CAPACITY * charWidthAt1px * fontSizePx).toBe(availableWidthPx);
    expect(fontSizePx).toBe(10);
  });

  it("scales the font in proportion to the page width", () => {
    const charWidthAt1px = 0.5;
    const narrow = fontSizeForLineCapacity(325, charWidthAt1px);
    const wide = fontSizeForLineCapacity(650, charWidthAt1px);

    expect(narrow).toBe(10);
    expect(wide).toBe(20);
  });

  it("keeps L at the auto-fit size and scales the others", () => {
    const autoFitPx = fontSizeForLineCapacity(390, 0.6);

    expect(fontSizeForLineCapacity(390, 0.6, fontSizeScale("l"))).toBe(autoFitPx);
    expect(fontSizeForLineCapacity(390, 0.6, fontSizeScale("xs"))).toBe(
      autoFitPx * 0.45,
    );
    expect(fontSizeForLineCapacity(390, 0.6, fontSizeScale("s"))).toBe(
      autoFitPx * 0.58,
    );
    expect(fontSizeForLineCapacity(390, 0.6, fontSizeScale("m"))).toBe(
      autoFitPx * 0.73,
    );
    expect(fontSizeForLineCapacity(390, 0.6, fontSizeScale("xl"))).toBe(
      autoFitPx * 1.37,
    );
  });
});

describe("contentWidthPx", () => {
  it("uses the content box, not the border box", () => {
    expect(contentWidthPx(1000, 110, 110)).toBe(779);
  });

  it("keeps the previous full-width measurement when padding is zero", () => {
    expect(contentWidthPx(390, 0, 0)).toBe(389);
  });
});

describe("verticalOriginPaddingPx", () => {
  it("places the first line at the vertical center of the page", () => {
    const editorHeightPx = 800;
    const lineHeightPx = 16;

    const paddingPx = verticalOriginPaddingPx(editorHeightPx, lineHeightPx);

    expect(paddingPx + lineHeightPx / 2).toBe(400);
    expect(paddingPx).toBe(392);
  });
});

describe("scrollTopToCenterLine", () => {
  it("scrolls so a later caret line sits at the vertical center", () => {
    const editorHeightPx = 800;
    const lineHeightPx = 16;
    const originPx = 392;
    const tenLinesPx = 160;
    const caretTopPx = originPx + tenLinesPx;

    const scrollTopPx = scrollTopToCenterLine(
      caretTopPx,
      editorHeightPx,
      lineHeightPx,
    );

    expect(scrollTopPx).toBe(160);
    expect(caretTopPx - scrollTopPx + lineHeightPx / 2).toBe(400);
  });
});
