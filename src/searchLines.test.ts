import { describe, expect, it } from "vitest";
import { searchLines } from "./searchLines";

describe("searchLines", () => {
  it("returns no hits when the query is empty or whitespace", () => {
    expect(searchLines("hello\nworld", "")).toEqual([]);
    expect(searchLines("hello\nworld", "   ")).toEqual([]);
  });

  it("matches a case-insensitive substring and reports 1-based lines", () => {
    expect(searchLines("Hello\nthere World\nend", "WORLD")).toEqual([
      { line: 2, text: "there World" },
    ]);
  });

  it("returns every matching line in document order", () => {
    expect(searchLines("alpha\nbeta\nalpha again", "alpha")).toEqual([
      { line: 1, text: "alpha" },
      { line: 3, text: "alpha again" },
    ]);
  });

  it("stops after 200 hits", () => {
    const text = Array.from({ length: 201 }, () => "needle").join("\n");
    expect(searchLines(text, "needle")).toHaveLength(200);
    expect(searchLines(text, "needle")[199]).toEqual({
      line: 200,
      text: "needle",
    });
  });
});
