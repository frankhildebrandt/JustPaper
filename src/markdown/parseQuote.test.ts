import { describe, expect, it } from "vitest";
import { parseQuote } from "./parseQuote";

describe("parseQuote", () => {
  it("parses consecutive quote lines and stops at a blank line", () => {
    const source = "> one\n> two\n\nplain";
    expect(parseQuote(source, 0)).toEqual({
      from: 0,
      to: 11,
      next: 12,
      lines: [
        { from: 0, to: 5, mark: { from: 0, to: 2 } },
        { from: 6, to: 11, mark: { from: 6, to: 8 } },
      ],
      callout: undefined,
    });
  });

  it("treats a missing space after > as a quote mark of length one", () => {
    expect(parseQuote(">hi", 0)).toEqual({
      from: 0,
      to: 3,
      next: 3,
      lines: [{ from: 0, to: 3, mark: { from: 0, to: 1 } }],
      callout: undefined,
    });
  });

  it("returns undefined when the line is not a quote", () => {
    expect(parseQuote("plain", 0)).toBeUndefined();
  });

  it("detects an Obsidian callout on the first quote line", () => {
    const source =
      "> [!info] Quelle\n> Repo-SSOT: `docs/adr.md`\n> more";
    expect(parseQuote(source, 0)?.callout).toEqual({
      type: "info",
      title: "Quelle",
      fold: "none",
      marker: { from: 2, to: 9 },
      titleRange: { from: 10, to: 16 },
    });
  });
});
