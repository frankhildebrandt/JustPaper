import { describe, expect, it } from "vitest";
import { parseCalloutHead, resolveCalloutType } from "./parseCallout";

describe("parseCalloutHead", () => {
  it("parses type and title from an Obsidian callout head", () => {
    expect(parseCalloutHead("[!info] Quelle")).toEqual({
      rawType: "info",
      type: "info",
      title: "Quelle",
      fold: "none",
      markerTo: 7,
    });
  });

  it("accepts fold markers and is case-insensitive", () => {
    expect(parseCalloutHead("[!WARNING]- Attention")).toEqual({
      rawType: "WARNING",
      type: "warning",
      title: "Attention",
      fold: "closed",
      markerTo: 11,
    });
    expect(parseCalloutHead("[!tip]+")).toEqual({
      rawType: "tip",
      type: "tip",
      title: undefined,
      fold: "open",
      markerTo: 7,
    });
  });

  it("maps aliases to canonical types", () => {
    expect(resolveCalloutType("hint")).toBe("tip");
    expect(resolveCalloutType("error")).toBe("danger");
    expect(resolveCalloutType("custom")).toBe("note");
  });

  it("returns undefined for ordinary quote text", () => {
    expect(parseCalloutHead("just a quote")).toBeUndefined();
    expect(parseCalloutHead("[info] missing bang")).toBeUndefined();
  });
});
