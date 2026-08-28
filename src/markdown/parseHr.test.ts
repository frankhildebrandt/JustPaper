import { describe, expect, it } from "vitest";
import { parseHr } from "./parseHr";

describe("parseHr", () => {
  it("parses a thematic break of three or more hyphens", () => {
    expect(parseHr("---\nnext", 0)).toEqual({
      from: 0,
      to: 3,
      next: 4,
    });
    expect(parseHr("----", 0)).toEqual({
      from: 0,
      to: 4,
      next: 4,
    });
  });

  it("rejects table delimiters and short dashes", () => {
    expect(parseHr("|---|", 0)).toBeUndefined();
    expect(parseHr("--", 0)).toBeUndefined();
    expect(parseHr("- - -", 0)).toBeUndefined();
    expect(parseHr("plain", 0)).toBeUndefined();
  });
});
