import { describe, expect, it } from "vitest";
import { parseTypst } from "./parse";
import { DEFAULT_TYPST_FEATURES, withTypstFeature } from "./features";

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
      name: "rect",
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
      name: "let",
      from: 0,
      to: 10,
      code: { from: 0, to: 10 },
    });
  });

  it("parses markup inside a hash content block", () => {
    const child = parseTypst("#text[Hello *W*]")[0]?.children[0];
    expect(child).toMatchObject({
      kind: "hash",
      name: "text",
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

  it("parses a linebreak from backslash plus space", () => {
    expect(parseTypst("Hello\\ World")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 5 },
      { kind: "linebreak", from: 5, to: 7 },
      { kind: "text", from: 7, to: 12 },
    ]);
  });

  it("parses smart quotes as opening and closing pairs", () => {
    expect(parseTypst(`"Hi"`)[0]?.children).toEqual([
      { kind: "smartquote", from: 0, to: 1, glyph: "\u201C" },
      { kind: "text", from: 1, to: 3 },
      { kind: "smartquote", from: 3, to: 4, glyph: "\u201D" },
    ]);
    expect(parseTypst("'Hi'")[0]?.children).toEqual([
      { kind: "smartquote", from: 0, to: 1, glyph: "\u2018" },
      { kind: "text", from: 1, to: 3 },
      { kind: "smartquote", from: 3, to: 4, glyph: "\u2019" },
    ]);
  });

  it("parses markup symbol shorthands", () => {
    expect(parseTypst("a---b")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 1 },
      { kind: "symbol", from: 1, to: 4, glyph: "\u2014" },
      { kind: "text", from: 4, to: 5 },
    ]);
    expect(parseTypst("a--b")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 1 },
      { kind: "symbol", from: 1, to: 3, glyph: "\u2013" },
      { kind: "text", from: 3, to: 4 },
    ]);
    expect(parseTypst("a...b")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 1 },
      { kind: "symbol", from: 1, to: 4, glyph: "\u2026" },
      { kind: "text", from: 4, to: 5 },
    ]);
    expect(parseTypst("a-?b")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 1 },
      { kind: "symbol", from: 1, to: 3, glyph: "\u00AD" },
      { kind: "text", from: 3, to: 4 },
    ]);
    expect(parseTypst("a~b")[0]?.children).toEqual([
      { kind: "text", from: 0, to: 1 },
      { kind: "symbol", from: 1, to: 2, glyph: "\u00A0" },
      { kind: "text", from: 2, to: 3 },
    ]);
  });

  it("does not parse shorthands inside raw, math, or hash code", () => {
    expect(parseTypst("`a---b`")[0]?.children[0]).toMatchObject({
      kind: "code",
      from: 0,
      to: 7,
    });
    expect(parseTypst("$a---b$")[0]?.children[0]).toMatchObject({
      kind: "math",
      from: 0,
      to: 7,
    });
    const hash = parseTypst('#rect("---")')[0]?.children[0];
    expect(hash).toMatchObject({ kind: "hash", name: "rect", from: 0, to: 12 });
    if (hash?.kind !== "hash") {
      throw new Error("expected hash");
    }
    expect(hash.children).toEqual([]);
  });

  it("leaves disabled syntax as plain paragraph text", () => {
    const off = (
      id:
        | "heading"
        | "strong"
        | "em"
        | "inlineCode"
        | "math"
        | "hash"
        | "list"
        | "linebreak"
        | "smartquote"
        | "symbols",
    ) => withTypstFeature(DEFAULT_TYPST_FEATURES, id, false);

    expect(parseTypst("= Title", off("heading"))[0]?.kind).toBe("paragraph");
    expect(parseTypst("say *hi*", off("strong"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 8 },
    ]);
    expect(parseTypst("say _hi_", off("em"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 8 },
    ]);
    expect(parseTypst("use `fn`", off("inlineCode"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 8 },
    ]);
    expect(parseTypst("$x$", off("math"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 3 },
    ]);
    expect(parseTypst("#rect()", off("hash"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 7 },
    ]);
    expect(parseTypst("- item", off("list"))[0]?.kind).toBe("paragraph");
    expect(parseTypst("Hello\\ World", off("linebreak"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 12 },
    ]);
    expect(parseTypst(`"Hi"`, off("smartquote"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 4 },
    ]);
    expect(parseTypst("a---b", off("symbols"))[0]?.children).toEqual([
      { kind: "text", from: 0, to: 5 },
    ]);
  });

  it("parses nested title-page functions, images, and lines", () => {
    const source = [
      "// Titelseite",
      "#align(center)[",
      "  #v(22%)",
      '  #text(size: 34pt, weight: "bold")[Eiserne Front]',
      '  #image("../art/symbol.png", width: 6.8cm)',
      '  #line(length: 35%, stroke: 1pt + rgb("6e7d86"))',
      "]",
      "#pagebreak()",
    ].join("\n");
    const blocks = parseTypst(source);
    expect(blocks[0]?.children[0]).toMatchObject({ kind: "comment" });
    const align = blocks[1]?.children.find((span) => span.kind === "hash");
    expect(align).toMatchObject({ kind: "hash", name: "align" });
    if (align?.kind !== "hash") {
      throw new Error("expected align");
    }
    const nested = align.children.filter((span) => span.kind === "hash");
    expect(nested.map((span) => span.kind === "hash" && span.name)).toEqual([
      "v",
      "text",
      "image",
      "line",
    ]);
    const image = nested.find((span) => span.kind === "hash" && span.name === "image");
    expect(image).toMatchObject({
      kind: "hash",
      imageSrc: "../art/symbol.png",
    });
    const title = nested.find((span) => span.kind === "hash" && span.name === "text");
    expect(title).toMatchObject({ kind: "hash", textStyle: "strong" });
    expect(blocks.at(-1)?.children[0]).toMatchObject({
      kind: "hash",
      name: "pagebreak",
    });
  });

  it("parses a book-table into a header and body rows", () => {
    const source = `#book-table(columns: (1fr, 2fr, 1fr),
  table.header([*Stufe*], [*Bedeutung*], [*Form*]),
  [Hoch], [Mehrere Belege], [gut belegt]
)`;
    const child = parseTypst(source)[0]?.children[0];
    expect(child).toMatchObject({ kind: "hash", name: "book-table" });
    if (child?.kind !== "hash" || child.table === undefined) {
      throw new Error("expected table");
    }
    expect(child.table.header).toHaveLength(3);
    expect(child.table.rows).toHaveLength(1);
    expect(child.table.rows[0]).toHaveLength(3);
    expect(
      child.table.header[0]?.children.some((span) => span.kind === "strong"),
    ).toBe(true);
  });

  it("parses a book-table of evidence grades", () => {
    const source = `#book-table(columns: (1.15fr, 2.4fr, 1.6fr),
  table.header([*Stufe*], [*Bedeutung*], [*Formulierung im Text*]),
  [Sehr hoch], [Direkter, konkret benannter Beleg oder gerichtliche Bewertung in den Arbeitsunterlagen], [„belegt“, mit genauer Einschränkung],
  [Hoch], [Mehrere institutionelle oder wissenschaftliche Belege; die Aussage ist tragfähig, aber nicht vollständig], [„gut belegt“],
  [Mittel], [Einzelne zeitgenössische, regionale oder administrative Quelle], [„berichtet“, „zugeschrieben“],
  [Vorläufig], [Findbuch, unvollständiger Aktenzugang oder nicht fallgenau geprüfte Darstellung], [„nicht abschließend belegt“],
  [Negativer Befund], [Im geprüften Online-Korpus kein Nachweis], [„nicht gefunden“, nicht „ausgeschlossen“]
)`;
    const child = parseTypst(source)[0]?.children[0];
    if (child?.kind !== "hash" || child.table === undefined) {
      throw new Error("expected table");
    }
    expect(child.table.header).toHaveLength(3);
    expect(child.table.rows).toHaveLength(5);
    expect(child.table.rows.every((row) => row.length === 3)).toBe(true);
  });
});
