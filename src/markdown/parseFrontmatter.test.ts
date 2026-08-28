import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./parseFrontmatter";

describe("parseFrontmatter", () => {
  it("parses a YAML fence at the start of the document", () => {
    const source = "---\ntitle: Hi\n---\n\n# Title";
    expect(parseFrontmatter(source, 0)).toEqual({
      from: 0,
      to: 18,
      next: 18,
    });
  });

  it("rejects a fence that is not at offset zero", () => {
    expect(parseFrontmatter("\n---\nx\n---\n", 1)).toBeUndefined();
  });

  it("rejects an unclosed opening fence", () => {
    expect(parseFrontmatter("---\ntitle: Hi\n", 0)).toBeUndefined();
  });

  it("rejects a first line that is not a fence", () => {
    expect(parseFrontmatter("# Title\n---\n", 0)).toBeUndefined();
  });
});
