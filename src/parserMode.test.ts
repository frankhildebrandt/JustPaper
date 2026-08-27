import { describe, expect, it } from "vitest";
import { checkedParserModeItems } from "./parserMode";

describe("checkedParserModeItems", () => {
  it("checks only Nur Text", () => {
    expect(checkedParserModeItems("plain")).toEqual({
      plain: true,
      markdownEdit: false,
      markdownView: false,
    });
  });

  it("checks only Markdown Edit", () => {
    expect(checkedParserModeItems("markdownEdit")).toEqual({
      plain: false,
      markdownEdit: true,
      markdownView: false,
    });
  });

  it("checks only Markdown View", () => {
    expect(checkedParserModeItems("markdownView")).toEqual({
      plain: false,
      markdownEdit: false,
      markdownView: true,
    });
  });
});
