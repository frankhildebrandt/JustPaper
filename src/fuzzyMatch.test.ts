import { describe, expect, it } from "vitest";
import { filterByQuery, fuzzyMatch } from "./fuzzyMatch";

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

describe("filterByQuery", () => {
  const items = [
    { title: "Later.md", detail: "recent" },
    { title: "Earlier.md", detail: "older note" },
    { title: "Other.txt", detail: "skip" },
  ];

  it("returns items in original order when the query is empty", () => {
    expect(filterByQuery(items, "", (item) => item.title)).toEqual(items);
  });

  it("keeps original order among subsequence matches", () => {
    expect(
      filterByQuery(items, "er.md", (item) => item.title).map((item) => item.title),
    ).toEqual(["Later.md", "Earlier.md"]);
  });

  it("is case-insensitive and searches the haystack", () => {
    expect(
      filterByQuery(items, "OLDER", (item) => `${item.title} ${item.detail}`).map(
        (item) => item.title,
      ),
    ).toEqual(["Earlier.md"]);
  });
});
