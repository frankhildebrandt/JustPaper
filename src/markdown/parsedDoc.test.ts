import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { DEFAULT_MARKDOWN_FEATURES, withMarkdownFeature } from "./features";
import { parseMarkdown } from "./parse";
import { DEFAULT_TYPST_FEATURES } from "../typst/features";
import { docSource, markdownBlocks, typstBlocks } from "./parsedDoc";

describe("parsed document cache", () => {
  it("parses each document version only once per feature set", () => {
    const doc = Text.of(["# Title", "body *em*"]);
    const first = markdownBlocks(doc, DEFAULT_MARKDOWN_FEATURES);
    expect(markdownBlocks(doc, DEFAULT_MARKDOWN_FEATURES)).toBe(first);
    expect(first).toEqual(
      parseMarkdown("# Title\nbody *em*", DEFAULT_MARKDOWN_FEATURES),
    );
  });

  it("re-parses when the features change", () => {
    const doc = Text.of(["# Title"]);
    const first = markdownBlocks(doc, DEFAULT_MARKDOWN_FEATURES);
    const noHeading = withMarkdownFeature(
      DEFAULT_MARKDOWN_FEATURES,
      "heading",
      false,
    );
    const second = markdownBlocks(doc, noHeading);
    expect(second).not.toBe(first);
    expect(second[0]?.kind).toBe("paragraph");
  });

  it("re-parses a new document version", () => {
    const doc = Text.of(["a"]);
    const next = doc.replace(1, 1, Text.of(["b"]));
    expect(markdownBlocks(next, DEFAULT_MARKDOWN_FEATURES)).not.toBe(
      markdownBlocks(doc, DEFAULT_MARKDOWN_FEATURES),
    );
  });

  it("caches the source string and typst blocks per document", () => {
    const doc = Text.of(["= Title"]);
    expect(docSource(doc)).toBe("= Title");
    expect(typstBlocks(doc, DEFAULT_TYPST_FEATURES)).toBe(
      typstBlocks(doc, DEFAULT_TYPST_FEATURES),
    );
  });
});
