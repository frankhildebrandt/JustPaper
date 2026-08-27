import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parse";

describe("parseMarkdown", () => {
  it("treats a plain line as a paragraph of text", () => {
    expect(parseMarkdown("hello")).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 5,
        children: [{ kind: "text", from: 0, to: 5 }],
      },
    ]);
  });

  it("parses an ATX heading with hashes and a required space", () => {
    expect(parseMarkdown("# Title")).toEqual([
      {
        kind: "heading",
        level: 1,
        from: 0,
        to: 7,
        atxFrom: 0,
        atxTo: 1,
        children: [{ kind: "text", from: 2, to: 7 }],
      },
    ]);
  });

  it("leaves hashes without a following space as paragraph text", () => {
    expect(parseMarkdown("#Title")).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 6,
        children: [{ kind: "text", from: 0, to: 6 }],
      },
    ]);
  });

  it("splits a heading and the following paragraph into separate blocks", () => {
    expect(parseMarkdown("# Title\nhello")).toEqual([
      {
        kind: "heading",
        level: 1,
        from: 0,
        to: 7,
        atxFrom: 0,
        atxTo: 1,
        children: [{ kind: "text", from: 2, to: 7 }],
      },
      {
        kind: "paragraph",
        from: 8,
        to: 13,
        children: [{ kind: "text", from: 8, to: 13 }],
      },
    ]);
  });

  it("marks a strong span and its surrounding asterisks", () => {
    expect(parseMarkdown("say **hi**")).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 10,
        children: [
          { kind: "text", from: 0, to: 4 },
          {
            kind: "strong",
            from: 4,
            to: 10,
            markOpen: { from: 4, to: 6 },
            markClose: { from: 8, to: 10 },
          },
        ],
      },
    ]);
  });

  it("leaves unclosed strong markers as text", () => {
    expect(parseMarkdown("say **hi")).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 8,
        children: [{ kind: "text", from: 0, to: 8 }],
      },
    ]);
  });

  it("marks an emphasis span and its surrounding asterisks", () => {
    expect(parseMarkdown("say *hi*")).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 8,
        children: [
          { kind: "text", from: 0, to: 4 },
          {
            kind: "em",
            from: 4,
            to: 8,
            markOpen: { from: 4, to: 5 },
            markClose: { from: 7, to: 8 },
          },
        ],
      },
    ]);
  });

  it("marks a code span and keeps asterisks inside it as text", () => {
    expect(parseMarkdown("use `*fn*`")).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 10,
        children: [
          { kind: "text", from: 0, to: 4 },
          {
            kind: "code",
            from: 4,
            to: 10,
            markOpen: { from: 4, to: 5 },
            markClose: { from: 9, to: 10 },
          },
        ],
      },
    ]);
  });

  it("parses strong inside a heading", () => {
    expect(parseMarkdown("# **Go**")).toEqual([
      {
        kind: "heading",
        level: 1,
        from: 0,
        to: 8,
        atxFrom: 0,
        atxTo: 1,
        children: [
          {
            kind: "strong",
            from: 2,
            to: 8,
            markOpen: { from: 2, to: 4 },
            markClose: { from: 6, to: 8 },
          },
        ],
      },
    ]);
  });

  it("parses a wiki link and an aliased wiki link", () => {
    expect(parseMarkdown("see [[Note]]")).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 12,
        children: [
          { kind: "text", from: 0, to: 4 },
          {
            kind: "wiki",
            from: 4,
            to: 12,
            target: "Note",
            alias: undefined,
            markOpen: { from: 4, to: 6 },
            markClose: { from: 10, to: 12 },
            label: { from: 6, to: 10 },
            suppress: undefined,
          },
        ],
      },
    ]);
    expect(parseMarkdown("[[Note|shown]]")).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 14,
        children: [
          {
            kind: "wiki",
            from: 0,
            to: 14,
            target: "Note",
            alias: "shown",
            markOpen: { from: 0, to: 2 },
            markClose: { from: 12, to: 14 },
            label: { from: 7, to: 12 },
            suppress: { from: 2, to: 7 },
          },
        ],
      },
    ]);
  });
});
