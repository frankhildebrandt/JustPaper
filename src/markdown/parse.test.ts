import { describe, expect, it } from "vitest";
import { withMarkdownFeature, DEFAULT_MARKDOWN_FEATURES } from "./features";
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
            children: [{ kind: "text", from: 6, to: 8 }],
          },
        ],
      },
    ]);
  });

  it("nests inline code inside strong so both styles apply", () => {
    expect(parseMarkdown("**`idoit.info`**")).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 16,
        children: [
          {
            kind: "strong",
            from: 0,
            to: 16,
            markOpen: { from: 0, to: 2 },
            markClose: { from: 14, to: 16 },
            children: [
              {
                kind: "code",
                from: 2,
                to: 14,
                markOpen: { from: 2, to: 3 },
                markClose: { from: 13, to: 14 },
                children: [],
              },
            ],
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
            children: [{ kind: "text", from: 5, to: 7 }],
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
            children: [],
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
            children: [{ kind: "text", from: 4, to: 6 }],
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

  it("leaves disabled syntax as plain paragraph text", () => {
    const off = (id: "heading" | "strong" | "em" | "inlineCode" | "wiki") =>
      withMarkdownFeature(DEFAULT_MARKDOWN_FEATURES, id, false);

    expect(parseMarkdown("# Title", off("heading"))).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 7,
        children: [{ kind: "text", from: 0, to: 7 }],
      },
    ]);
    expect(parseMarkdown("say **hi**", off("strong"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 10 },
    ]);
    expect(parseMarkdown("say *hi*", off("em"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 8 },
    ]);
    expect(parseMarkdown("use `fn`", off("inlineCode"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 8 },
    ]);
    expect(parseMarkdown("see [[Note]]", off("wiki"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 12 },
    ]);
  });

  it("parses YAML frontmatter at the start of the document", () => {
    expect(parseMarkdown("---\ntitle: Hi\n---\n\n# Title")).toEqual([
      {
        kind: "frontmatter",
        from: 0,
        to: 18,
      },
      {
        kind: "heading",
        level: 1,
        from: 19,
        to: 26,
        atxFrom: 19,
        atxTo: 20,
        children: [{ kind: "text", from: 21, to: 26 }],
      },
    ]);
  });

  it("leaves incomplete frontmatter fences as thematic breaks and text", () => {
    const off = withMarkdownFeature(
      DEFAULT_MARKDOWN_FEATURES,
      "frontmatter",
      false,
    );
    expect(parseMarkdown("---\ntitle: Hi\n---\n", off)).toEqual([
      { kind: "hr", from: 0, to: 3 },
      {
        kind: "paragraph",
        from: 4,
        to: 13,
        children: [{ kind: "text", from: 4, to: 13 }],
      },
      { kind: "hr", from: 14, to: 17 },
    ]);
  });

  it("parses a thematic break outside tables and frontmatter", () => {
    expect(parseMarkdown("before\n---\nafter")).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 6,
        children: [{ kind: "text", from: 0, to: 6 }],
      },
      { kind: "hr", from: 7, to: 10 },
      {
        kind: "paragraph",
        from: 11,
        to: 16,
        children: [{ kind: "text", from: 11, to: 16 }],
      },
    ]);
  });

  it("parses a blockquote and a fenced code block", () => {
    expect(parseMarkdown("> one\n> two")).toEqual([
      {
        kind: "blockquote",
        from: 0,
        to: 11,
        callout: undefined,
        lines: [
          {
            from: 0,
            to: 5,
            mark: { from: 0, to: 2 },
            children: [{ kind: "text", from: 2, to: 5 }],
          },
          {
            from: 6,
            to: 11,
            mark: { from: 6, to: 8 },
            children: [{ kind: "text", from: 8, to: 11 }],
          },
        ],
      },
    ]);
    expect(parseMarkdown("```ts\nconst x = 1\n```\n")).toEqual([
      {
        kind: "codeblock",
        from: 0,
        to: 22,
        open: { from: 0, to: 6 },
        close: { from: 18, to: 22 },
        language: "ts",
      },
    ]);
  });

  it("leaves quotes and fences as paragraphs when those features are off", () => {
    expect(
      parseMarkdown(
        "> hi",
        withMarkdownFeature(DEFAULT_MARKDOWN_FEATURES, "blockquote", false),
      )[0]?.kind,
    ).toBe("paragraph");
    expect(
      parseMarkdown(
        "```\nhi\n```",
        withMarkdownFeature(DEFAULT_MARKDOWN_FEATURES, "codeblock", false),
      )[0]?.kind,
    ).toBe("paragraph");
  });

  it("parses a GFM table and an external link", () => {
    expect(parseMarkdown("|a|\n|-|\n|b|")[0]).toMatchObject({
      kind: "table",
      from: 0,
      to: 11,
      header: { from: 0, to: 3 },
      delimiter: { from: 4, to: 7 },
    });
    expect(parseMarkdown("[docs](https://example.com)")[0]?.children).toEqual([
      {
        kind: "link",
        from: 0,
        to: 27,
        markOpen: { from: 0, to: 1 },
        markClose: { from: 5, to: 27 },
        label: { from: 1, to: 5 },
        href: "https://example.com",
        dest: { from: 7, to: 26 },
        alt: "docs",
      },
    ]);
    expect(parseMarkdown("![logo](pic.png)")[0]?.children).toEqual([
      {
        kind: "image",
        from: 0,
        to: 16,
        markOpen: { from: 0, to: 2 },
        markClose: { from: 6, to: 16 },
        label: { from: 2, to: 6 },
        href: "pic.png",
        dest: { from: 8, to: 15 },
        alt: "logo",
      },
    ]);
  });

  it("leaves tables and links as text when those features are off", () => {
    expect(
      parseMarkdown(
        "|a|\n|-|\n|b|",
        withMarkdownFeature(DEFAULT_MARKDOWN_FEATURES, "table", false),
      )[0]?.kind,
    ).toBe("paragraph");
    expect(
      parseMarkdown(
        "[docs](https://example.com)",
        withMarkdownFeature(DEFAULT_MARKDOWN_FEATURES, "externalLink", false),
      )[0]?.children,
    ).toEqual([{ kind: "text", from: 0, to: 27 }]);
    expect(
      parseMarkdown(
        "![logo](pic.png)",
        withMarkdownFeature(DEFAULT_MARKDOWN_FEATURES, "image", false),
      )[0]?.children,
    ).toEqual([{ kind: "text", from: 0, to: 16 }]);
  });

  it("parses a task line and leaves it as a paragraph when todos are off", () => {
    expect(parseMarkdown("- [ ] milk")).toEqual([
      {
        kind: "todo",
        from: 0,
        to: 10,
        listMark: { from: 0, to: 2 },
        box: { from: 2, to: 5 },
        checked: false,
        contentFrom: 6,
        children: [{ kind: "text", from: 6, to: 10 }],
      },
    ]);
    expect(
      parseMarkdown(
        "- [ ] milk",
        withMarkdownFeature(DEFAULT_MARKDOWN_FEATURES, "todo", false),
      )[0]?.kind,
    ).toBe("paragraph");
  });
});
