import { describe, expect, it } from "vitest";
import { parseTypst } from "./parse";

describe("parseTypst", () => {
  it("parses a plain paragraph", () => {
    expect(parseTypst("hello")).toEqual([
      {
        kind: "paragraph",
        from: 0,
        to: 5,
        children: [{ kind: "text", from: 0, to: 5 }],
      },
    ]);
  });

  it("parses a heading with equals marks", () => {
    expect(parseTypst("= Title")).toEqual([
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

  it("does not treat equals without a space as a heading", () => {
    expect(parseTypst("=Title")[0]?.kind).toBe("paragraph");
  });

  it("does not treat a markdown hash heading as a Typst heading", () => {
    const block = parseTypst("# Title")[0];
    expect(block?.kind).toBe("paragraph");
    expect(block?.children).toEqual([{ kind: "text", from: 0, to: 7 }]);
  });

  it("parses strong with a single asterisk", () => {
    expect(parseTypst("say *hi*")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 4 },
      {
        kind: "strong",
        from: 4,
        to: 8,
        markOpen: { from: 4, to: 5 },
        markClose: { from: 7, to: 8 },
        children: [{ kind: "text", from: 5, to: 7 }],
      },
    ]);
  });

  it("parses emphasis with underscores", () => {
    expect(parseTypst("say _hi_")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 4 },
      {
        kind: "em",
        from: 4,
        to: 8,
        markOpen: { from: 4, to: 5 },
        markClose: { from: 7, to: 8 },
        children: [{ kind: "text", from: 5, to: 7 }],
      },
    ]);
  });

  it("parses inline raw backticks", () => {
    expect(parseTypst("use `fn`")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 4 },
      {
        kind: "code",
        from: 4,
        to: 8,
        markOpen: { from: 4, to: 5 },
        markClose: { from: 7, to: 8 },
        children: [],
      },
    ]);
  });

  it("parses inline math", () => {
    expect(parseTypst("see $x^2$")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 4 },
      {
        kind: "math",
        from: 4,
        to: 9,
        markOpen: { from: 4, to: 5 },
        markClose: { from: 8, to: 9 },
        children: [],
      },
    ]);
  });

  it("parses a hash function call", () => {
    const child = parseTypst("#rect(width: 1cm)")[0]?.children[0];
    expect(child).toMatchObject({
      kind: "hash",
      from: 0,
      to: 17,
      code: { from: 0, to: 17 },
      children: [],
    });
  });

  it("parses a let statement as a hash span", () => {
    const child = parseTypst("#let x = 1")[0]?.children[0];
    expect(child).toMatchObject({
      kind: "hash",
      from: 0,
      to: 10,
      code: { from: 0, to: 10 },
    });
  });

  it("parses markup inside a hash content block", () => {
    const child = parseTypst("#text[Hello *W*]")[0]?.children[0];
    expect(child).toMatchObject({
      kind: "hash",
      from: 0,
      to: 16,
      code: { from: 0, to: 5 },
      contentOpen: { from: 5, to: 6 },
      contentClose: { from: 15, to: 16 },
    });
    if (child?.kind !== "hash") {
      throw new Error("expected hash");
    }
    expect(child.children.some((span) => span.kind === "strong")).toBe(true);
  });

  it("does not parse an escaped hash as code", () => {
    expect(parseTypst("Tweet \\#ad")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 10 },
    ]);
  });

  it("parses line and block comments", () => {
    expect(parseTypst("// note")[0]?.children[0]).toMatchObject({
      kind: "comment",
      from: 0,
      to: 7,
    });
    expect(parseTypst("a /* b */ c")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 2 },
      { kind: "comment", from: 2, to: 9 },
      { kind: "text", from: 9, to: 11 },
    ]);
  });

  it("parses autolinks, labels, and refs", () => {
    const children = parseTypst("see https://typst.app/ <intro> @intro")[0]
      ?.children;
    expect(children?.map((span) => span.kind)).toEqual([
      "text",
      "link",
      "text",
      "label",
      "text",
      "ref",
    ]);
  });

  it("parses bullet, numbered, and term lists", () => {
    expect(parseTypst("- item")[0]).toMatchObject({
      kind: "list",
      listKind: "bullet",
      mark: { from: 0, to: 2 },
    });
    expect(parseTypst("+ item")[0]).toMatchObject({
      kind: "list",
      listKind: "enum",
    });
    expect(parseTypst("/ Term: desc")[0]).toMatchObject({
      kind: "list",
      listKind: "term",
    });
  });

  it("parses a raw fence as a code block", () => {
    expect(parseTypst("```ts\nconst x = 1\n```\n")[0]).toMatchObject({
      kind: "codeblock",
      language: "ts",
    });
  });
});
