import { describe, expect, it } from "vitest";
import {
  DEFAULT_MARKDOWN_FEATURES,
  checkedMarkdownFeatureItems,
  withMarkdownFeature,
} from "./features";

describe("DEFAULT_MARKDOWN_FEATURES", () => {
  it("enables the safe markdown features by default", () => {
    expect(DEFAULT_MARKDOWN_FEATURES).toEqual({
      heading: true,
      strong: true,
      em: true,
      inlineCode: true,
      wiki: true,
      table: true,
      blockquote: true,
      codeblock: true,
      image: true,
      externalImage: false,
      externalLink: true,
      frontmatter: true,
      todo: true,
    });
  });
});

describe("checkedMarkdownFeatureItems", () => {
  it("mirrors the feature flags for menu checks", () => {
    const features = withMarkdownFeature(
      DEFAULT_MARKDOWN_FEATURES,
      "table",
      false,
    );
    expect(checkedMarkdownFeatureItems(features).table).toBe(false);
    expect(checkedMarkdownFeatureItems(features).heading).toBe(true);
  });
});

describe("withMarkdownFeature", () => {
  it("returns a new object with one flag changed", () => {
    const next = withMarkdownFeature(DEFAULT_MARKDOWN_FEATURES, "wiki", false);
    expect(next.wiki).toBe(false);
    expect(DEFAULT_MARKDOWN_FEATURES.wiki).toBe(true);
  });
});
