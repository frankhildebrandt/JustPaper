import { describe, expect, it } from "vitest";
import { decorationSpecs, headingPrefixRanges } from "./decorationSpecs";
import { parseMarkdown } from "./parse";

describe("decorationSpecs", () => {
  it("styles a heading line and shows hanging ATX marks while editing", () => {
    expect(
      decorationSpecs(parseMarkdown("# Title"), { showMarks: true }),
    ).toEqual([
      { kind: "line-h1", from: 0, to: 7 },
      { kind: "atx", from: 0, to: 2 },
    ]);
  });

  it("hides ATX hashes and their required space in view", () => {
    expect(
      decorationSpecs(parseMarkdown("# Title"), { showMarks: false }),
    ).toEqual([
      { kind: "line-h1", from: 0, to: 7 },
      { kind: "hide", from: 0, to: 2 },
    ]);
  });

  it("styles strong text and keeps marker ranges visible while editing", () => {
    expect(
      decorationSpecs(parseMarkdown("say **hi**"), { showMarks: true }),
    ).toEqual([
      { kind: "mark", from: 4, to: 6 },
      { kind: "strong", from: 6, to: 8 },
      { kind: "mark", from: 8, to: 10 },
    ]);
  });

  it("hides strong markers in view and keeps the inner style", () => {
    expect(
      decorationSpecs(parseMarkdown("say **hi**"), { showMarks: false }),
    ).toEqual([
      { kind: "hide", from: 4, to: 6 },
      { kind: "strong", from: 6, to: 8 },
      { kind: "hide", from: 8, to: 10 },
    ]);
  });

  it("styles emphasis and code the same way as strong", () => {
    const em = decorationSpecs(parseMarkdown("*x*"), { showMarks: true });
    const code = decorationSpecs(parseMarkdown("`x`"), { showMarks: true });

    expect(em).toEqual([
      { kind: "mark", from: 0, to: 1 },
      { kind: "em", from: 1, to: 2 },
      { kind: "mark", from: 2, to: 3 },
    ]);
    expect(code).toEqual([
      { kind: "mark", from: 0, to: 1 },
      { kind: "code", from: 1, to: 2 },
      { kind: "mark", from: 2, to: 3 },
    ]);
  });

  it("styles a wiki link and hides its marks in view", () => {
    expect(
      decorationSpecs(parseMarkdown("[[Note]]"), { showMarks: true }),
    ).toEqual([
      { kind: "mark", from: 0, to: 2 },
      { kind: "wiki", from: 2, to: 6 },
      { kind: "mark", from: 6, to: 8 },
    ]);
    expect(
      decorationSpecs(parseMarkdown("[[Note|shown]]"), { showMarks: false }),
    ).toEqual([
      { kind: "hide", from: 0, to: 2 },
      { kind: "hide", from: 2, to: 7 },
      { kind: "wiki", from: 7, to: 12 },
      { kind: "hide", from: 12, to: 14 },
    ]);
  });
});

describe("headingPrefixRanges", () => {
  it("covers hashes and the hidden space so the caret cannot sit in the gap", () => {
    expect(headingPrefixRanges(parseMarkdown("# Title"))).toEqual([
      { from: 0, to: 2 },
    ]);
    expect(headingPrefixRanges(parseMarkdown("## Title"))).toEqual([
      { from: 0, to: 3 },
    ]);
  });
});
