import { describe, expect, it } from "vitest";
import {
  completedWikiLink,
  openWikiQuery,
  wikiInsertTarget,
} from "./openWikiQuery";

describe("openWikiQuery", () => {
  it("opens after [[ with an empty query", () => {
    expect(openWikiQuery("[[", 2)).toEqual({ from: 0, query: "" });
  });

  it("reads the query between [[ and the caret", () => {
    expect(openWikiQuery("see [[Note", 10)).toEqual({
      from: 4,
      query: "Note",
    });
  });

  it("returns undefined when the link is already closed", () => {
    expect(openWikiQuery("[[Note]]", 6)).toBeUndefined();
  });

  it("returns undefined when the caret is before [[", () => {
    expect(openWikiQuery("[[Note", 0)).toBeUndefined();
  });

  it("returns undefined when the inner text contains a pipe", () => {
    expect(openWikiQuery("[[Note|", 7)).toBeUndefined();
  });

  it("returns undefined when the inner text contains a bracket", () => {
    expect(openWikiQuery("[[No[te", 7)).toBeUndefined();
  });

  it("uses the last open [[ before the caret", () => {
    expect(openWikiQuery("[[Done]] and [[New", 18)).toEqual({
      from: 13,
      query: "New",
    });
  });
});

describe("wikiInsertTarget", () => {
  it("strips a markdown extension", () => {
    expect(wikiInsertTarget("Hello.md")).toBe("Hello");
  });

  it("keeps nested paths without the extension", () => {
    expect(wikiInsertTarget("Notes/Hello.md")).toBe("Notes/Hello");
  });

  it("strips a txt extension", () => {
    expect(wikiInsertTarget("scratch.txt")).toBe("scratch");
  });
});

describe("completedWikiLink", () => {
  it("wraps a target in closed wiki brackets", () => {
    expect(completedWikiLink("Notes/Hello")).toBe("[[Notes/Hello]]");
  });
});
