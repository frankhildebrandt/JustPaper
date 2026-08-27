import { describe, expect, it } from "vitest";
import {
  activeParagraphIndex,
  dimRanges,
  focusRange,
  paragraphRanges,
} from "./highlightRange";

describe("focusRange", () => {
  it("dims nothing when highlight is off", () => {
    expect(focusRange("hello", 2, "none")).toBeUndefined();
  });

  it("keeps the caret paragraph in focus and treats a blank line as its trailing edge", () => {
    expect(focusRange("one\n\ntwo", 1, "paragraph")).toEqual({
      from: 0,
      to: 5,
    });
  });

  it("keeps the second paragraph in focus after the blank line", () => {
    expect(focusRange("one\n\ntwo", 5, "paragraph")).toEqual({
      from: 5,
      to: 8,
    });
  });

  it("does not split a paragraph on a single newline", () => {
    expect(focusRange("one\ntwo", 4, "paragraph")).toEqual({
      from: 0,
      to: 7,
    });
  });

  it("keeps a caret on the separating blank line with the previous paragraph", () => {
    expect(focusRange("one\n\ntwo", 3, "paragraph")).toEqual({
      from: 0,
      to: 5,
    });
  });

  it("keeps the sentence that ends at period-space in focus", () => {
    expect(focusRange("Hello. World.", 1, "sentence")).toEqual({
      from: 0,
      to: 7,
    });
  });

  it("keeps the sentence after period-space in focus", () => {
    expect(focusRange("Hello. World.", 8, "sentence")).toEqual({
      from: 7,
      to: 13,
    });
  });

  it("does not let a sentence cross a paragraph boundary", () => {
    expect(focusRange("Hi. There.\n\nBye.", 14, "sentence")).toEqual({
      from: 12,
      to: 16,
    });
  });

  it("ends a sentence at a period followed by a paragraph break", () => {
    expect(focusRange("Hi.\n\nBye.", 1, "sentence")).toEqual({
      from: 0,
      to: 5,
    });
  });

  it("treats a paragraph without a period as one sentence", () => {
    expect(focusRange("no period", 3, "sentence")).toEqual({
      from: 0,
      to: 9,
    });
  });

  it("does not end a sentence on a period that is not followed by a space", () => {
    expect(focusRange("See v1.2 now.", 1, "sentence")).toEqual({
      from: 0,
      to: 13,
    });
  });

  it("keeps the heading and its following paragraph in focus", () => {
    expect(focusRange("# Title\nhello", 9, "headline")).toEqual({
      from: 0,
      to: 13,
    });
  });

  it("ends a nested heading at the next heading of the same or higher level", () => {
    expect(focusRange("# H1\ntext\n## H2\nmore\n# Next", 17, "headline")).toEqual({
      from: 10,
      to: 21,
    });
  });

  it("keeps nested headings inside a higher-level section", () => {
    expect(focusRange("# H1\ntext\n## H2\nmore\n# Next", 6, "headline")).toEqual({
      from: 0,
      to: 21,
    });
  });

  it("dims nothing when no heading sits above the caret", () => {
    expect(focusRange("intro\n# Title", 1, "headline")).toBeUndefined();
  });
});

describe("dimRanges", () => {
  it("returns no dim ranges when highlight is off", () => {
    expect(dimRanges("hello", 2, "none")).toEqual([]);
  });

  it("dims the paragraphs that are not under the caret", () => {
    expect(dimRanges("one\n\ntwo", 1, "paragraph")).toEqual([
      { from: 5, to: 8 },
    ]);
  });
});

describe("paragraphRanges", () => {
  it("keeps trailing blank lines with the preceding paragraph", () => {
    expect(paragraphRanges("one\n\ntwo\n\nthree")).toEqual([
      { from: 0, to: 5 },
      { from: 5, to: 10 },
      { from: 10, to: 15 },
    ]);
  });

  it("treats an empty document as one empty paragraph", () => {
    expect(paragraphRanges("")).toEqual([{ from: 0, to: 0 }]);
  });
});

describe("activeParagraphIndex", () => {
  it("returns the paragraph that contains the caret", () => {
    expect(activeParagraphIndex("one\n\ntwo\n\nthree", 6)).toBe(1);
  });

  it("keeps a caret on the separating blank line with the previous paragraph", () => {
    expect(activeParagraphIndex("one\n\ntwo", 3)).toBe(0);
  });
});
