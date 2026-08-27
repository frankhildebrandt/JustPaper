import { describe, expect, it } from "vitest";
import {
  filenameFlowHiddenByPeek,
  filenameFlowTopPx,
  filenameFlowVisible,
  filenameReservePx,
} from "./filenameLayout";

describe("filenameFlowTopPx", () => {
  it("sits above the first line by the filename height and gap", () => {
    expect(
      filenameFlowTopPx({
        paddingTopPx: 392,
        scrollTopPx: 0,
        filenameHeightPx: 25,
        gapPx: 8,
      }),
    ).toBe(359);
  });

  it("scrolls away with the content", () => {
    expect(
      filenameFlowTopPx({
        paddingTopPx: 392,
        scrollTopPx: 400,
        filenameHeightPx: 25,
        gapPx: 8,
      }),
    ).toBe(-41);
  });
});

describe("filenameFlowVisible", () => {
  it("is visible while any part of the name is in the viewport", () => {
    expect(filenameFlowVisible(10, 25, 800)).toBe(true);
    expect(filenameFlowVisible(-10, 25, 800)).toBe(true);
    expect(filenameFlowVisible(790, 25, 800)).toBe(true);
  });

  it("is hidden once it has scrolled fully out", () => {
    expect(filenameFlowVisible(-25, 25, 800)).toBe(false);
    expect(filenameFlowVisible(800, 25, 800)).toBe(false);
  });
});

describe("filenameFlowHiddenByPeek", () => {
  it("hides the in-flow name when the top peek would cover it", () => {
    expect(filenameFlowHiddenByPeek(8, true, 40)).toBe(true);
    expect(filenameFlowHiddenByPeek(80, true, 40)).toBe(false);
    expect(filenameFlowHiddenByPeek(8, false, 40)).toBe(false);
  });
});

describe("filenameReservePx", () => {
  it("reserves one line plus a half-line gap above the first text line", () => {
    expect(filenameReservePx(16)).toBe(24);
  });
});
