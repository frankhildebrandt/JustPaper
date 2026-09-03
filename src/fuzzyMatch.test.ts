import { describe, expect, it } from "vitest";
import {
  filterByQuery,
  fuzzyMatch,
  fuzzyMatchNotes,
  matchingTags,
} from "./fuzzyMatch";

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

describe("matchingTags", () => {
  it("returns no tags when the query is empty", () => {
    expect(matchingTags(["work", "inbox"], "")).toEqual([]);
  });

  it("returns only tags that contain the query as a subsequence", () => {
    expect(matchingTags(["work", "inbox", "project"], "wk")).toEqual(["work"]);
  });

  it("is case-insensitive and ignores a leading hash on the query", () => {
    expect(matchingTags(["Inbox", "work"], "#IN")).toEqual(["Inbox"]);
  });
});

describe("fuzzyMatchNotes", () => {
  const notes = [
    { path: "Hello.md", tags: ["inbox"] },
    { path: "folder/Note.md", tags: ["work"] },
    { path: "drafts/ideas.txt", tags: [] },
  ];

  it("returns every file and no badges when the query is empty", () => {
    expect(fuzzyMatchNotes(notes, "")).toEqual([
      { path: "Hello.md", matchedTags: [] },
      { path: "folder/Note.md", matchedTags: [] },
      { path: "drafts/ideas.txt", matchedTags: [] },
    ]);
  });

  it("matches a path without attaching unmatched tags", () => {
    expect(fuzzyMatchNotes(notes, "Hello")).toEqual([
      { path: "Hello.md", matchedTags: [] },
    ]);
  });

  it("matches a tag and returns only the tags that hit", () => {
    expect(fuzzyMatchNotes(notes, "work")).toEqual([
      { path: "folder/Note.md", matchedTags: ["work"] },
    ]);
  });

  it("ranks path hits before tag-only hits", () => {
    expect(
      fuzzyMatchNotes(
        [
          { path: "zeta.md", tags: ["note"] },
          { path: "a/Note.md", tags: [] },
          { path: "Note.md", tags: [] },
        ],
        "Note",
      ),
    ).toEqual([
      { path: "Note.md", matchedTags: [] },
      { path: "a/Note.md", matchedTags: [] },
      { path: "zeta.md", matchedTags: ["note"] },
    ]);
  });

  it("sorts tag-only hits alphabetically by path", () => {
    expect(
      fuzzyMatchNotes(
        [
          { path: "b.md", tags: ["inbox"] },
          { path: "a.md", tags: ["inbox"] },
        ],
        "inbox",
      ),
    ).toEqual([
      { path: "a.md", matchedTags: ["inbox"] },
      { path: "b.md", matchedTags: ["inbox"] },
    ]);
  });
});
