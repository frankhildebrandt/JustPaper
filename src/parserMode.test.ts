import { describe, expect, it } from "vitest";
import { checkedParserModeItems, parserModeForPath } from "./parserMode";

describe("checkedParserModeItems", () => {
  it("checks only Nur Text", () => {
    expect(checkedParserModeItems("plain")).toEqual({
      plain: true,
      markdownEdit: false,
      markdownView: false,
      typstEdit: false,
      typstView: false,
    });
  });

  it("checks only Markdown Edit", () => {
    expect(checkedParserModeItems("markdownEdit")).toEqual({
      plain: false,
      markdownEdit: true,
      markdownView: false,
      typstEdit: false,
      typstView: false,
    });
  });

  it("checks only Markdown View", () => {
    expect(checkedParserModeItems("markdownView")).toEqual({
      plain: false,
      markdownEdit: false,
      markdownView: true,
      typstEdit: false,
      typstView: false,
    });
  });

  it("checks only Typst Edit", () => {
    expect(checkedParserModeItems("typstEdit")).toEqual({
      plain: false,
      markdownEdit: false,
      markdownView: false,
      typstEdit: true,
      typstView: false,
    });
  });
});

describe("parserModeForPath", () => {
  it("leaves Nur Text unchanged", () => {
    expect(parserModeForPath("/vault/Paper.typ", "plain")).toBe("plain");
  });

  it("switches markdown edit to typst edit for .typ", () => {
    expect(parserModeForPath("/vault/Paper.typ", "markdownEdit")).toBe(
      "typstEdit",
    );
  });

  it("keeps view when opening a typst file", () => {
    expect(parserModeForPath("/vault/Paper.typ", "markdownView")).toBe(
      "typstView",
    );
  });

  it("switches typst edit to markdown edit for .md", () => {
    expect(parserModeForPath("/vault/Hello.md", "typstEdit")).toBe(
      "markdownEdit",
    );
  });

  it("leaves the mode unchanged for .txt", () => {
    expect(parserModeForPath("/vault/notes.txt", "markdownEdit")).toBe(
      "markdownEdit",
    );
  });

  it("leaves the mode unchanged without a path", () => {
    expect(parserModeForPath(null, "typstEdit")).toBe("typstEdit");
  });
});
