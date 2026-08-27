import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "./fuzzyMatch";

describe("fuzzyMatch", () => {
  const files = ["Hello.md", "folder/Note.md", "drafts/ideas.txt"];

  it("returns all files when the query is empty", () => {
    expect(fuzzyMatch(files, "")).toEqual(files);
  });

  it("matches a subsequence in the relative path", () => {
    expect(fuzzyMatch(files, "fnote")).toEqual(["folder/Note.md"]);
  });

  it("is case-insensitive", () => {
    expect(fuzzyMatch(files, "HELLO")).toEqual(["Hello.md"]);
  });

  it("ranks basename hits before path-only hits", () => {
    expect(fuzzyMatch(["a/Note.md", "Note.md"], "Note")).toEqual([
      "Note.md",
      "a/Note.md",
    ]);
  });
});
