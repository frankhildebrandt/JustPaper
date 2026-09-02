import { describe, expect, it } from "vitest";
import {
  DEFAULT_TYPST_FEATURES,
  checkedTypstFeatureItems,
  withTypstFeature,
} from "./features";

describe("DEFAULT_TYPST_FEATURES", () => {
  it("enables every typst markup feature by default", () => {
    expect(DEFAULT_TYPST_FEATURES).toEqual({
      heading: true,
      strong: true,
      em: true,
      inlineCode: true,
      math: true,
      link: true,
      label: true,
      ref: true,
      list: true,
      codeblock: true,
      hash: true,
      comment: true,
      linebreak: true,
      smartquote: true,
      symbols: true,
    });
  });
});

describe("checkedTypstFeatureItems", () => {
  it("mirrors the feature flags for menu checks", () => {
    const features = withTypstFeature(DEFAULT_TYPST_FEATURES, "math", false);
    expect(checkedTypstFeatureItems(features).math).toBe(false);
    expect(checkedTypstFeatureItems(features).heading).toBe(true);
  });
});

describe("withTypstFeature", () => {
  it("returns a new object with one flag changed", () => {
    const next = withTypstFeature(DEFAULT_TYPST_FEATURES, "hash", false);
    expect(next.hash).toBe(false);
    expect(DEFAULT_TYPST_FEATURES.hash).toBe(true);
  });
});
