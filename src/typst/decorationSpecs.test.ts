import { describe, expect, it } from "vitest";
import { typstDecorationSpecs, typstHeadingPrefixRanges } from "./decorationSpecs";
import { parseTypst } from "./parse";

describe("typstDecorationSpecs", () => {
  it("shows heading marks in edit and hides them in view", () => {
    expect(
      typstDecorationSpecs(parseTypst("= Title"), { showMarks: true }),
    ).toEqual([
      { kind: "line-h1", from: 0, to: 7 },
      { kind: "atx", from: 0, to: 2 },
    ]);
    expect(
      typstDecorationSpecs(parseTypst("= Title"), { showMarks: false }),
    ).toEqual([
      { kind: "line-h1", from: 0, to: 7 },
      { kind: "hide", from: 0, to: 2 },
    ]);
  });

  it("styles strong and hides markers in view", () => {
    expect(
      typstDecorationSpecs(parseTypst("say *hi*"), { showMarks: true }),
    ).toEqual([
      { kind: "mark", from: 4, to: 5 },
      { kind: "strong", from: 5, to: 7 },
      { kind: "mark", from: 7, to: 8 },
    ]);
    expect(
      typstDecorationSpecs(parseTypst("say *hi*"), { showMarks: false }),
    ).toEqual([
      { kind: "hide", from: 4, to: 5 },
      { kind: "strong", from: 5, to: 7 },
      { kind: "hide", from: 7, to: 8 },
    ]);
  });

  it("styles math, comments, and hash code", () => {
    expect(
      typstDecorationSpecs(parseTypst("$x$"), { showMarks: true }),
    ).toEqual([
      { kind: "mark", from: 0, to: 1 },
      { kind: "math", from: 1, to: 2 },
      { kind: "mark", from: 2, to: 3 },
    ]);
    expect(
      typstDecorationSpecs(parseTypst("// hi"), { showMarks: true }),
    ).toEqual([{ kind: "comment", from: 0, to: 5 }]);
    expect(
      typstDecorationSpecs(parseTypst("#rect()"), { showMarks: true }),
    ).toEqual([{ kind: "hash", from: 0, to: 7 }]);
  });

  it("hides hash content brackets in view and keeps inner markup", () => {
    const specs = typstDecorationSpecs(parseTypst("#text[*Hi*]"), {
      showMarks: false,
    });
    expect(specs).toContainEqual({ kind: "hash", from: 0, to: 5 });
    expect(specs).toContainEqual({ kind: "hide", from: 5, to: 6 });
    expect(specs).toContainEqual({ kind: "strong", from: 7, to: 9 });
    expect(specs).toContainEqual({ kind: "hide", from: 10, to: 11 });
  });

  it("marks list prefixes", () => {
    expect(
      typstDecorationSpecs(parseTypst("- item"), { showMarks: true }),
    ).toEqual([
      { kind: "line-list", from: 0, to: 6 },
      { kind: "mark", from: 0, to: 2 },
    ]);
  });
});

describe("typstHeadingPrefixRanges", () => {
  it("covers the equals marks plus the following space", () => {
    expect(typstHeadingPrefixRanges(parseTypst("= Title"))).toEqual([
      { from: 0, to: 2 },
    ]);
    expect(typstHeadingPrefixRanges(parseTypst("== Title"))).toEqual([
      { from: 0, to: 3 },
    ]);
  });
});
