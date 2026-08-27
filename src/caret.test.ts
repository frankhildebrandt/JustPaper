import { describe, expect, it } from "vitest";
import {
  lineAtOffset,
  linesPerPage,
  offsetAfterPage,
  offsetAtLine,
} from "./caret";

describe("offsetAtLine", () => {
  it("puts the caret at the start of a 1-based line", () => {
    expect(offsetAtLine("a\nb\nc", 1)).toBe(0);
    expect(offsetAtLine("a\nb\nc", 2)).toBe(2);
    expect(offsetAtLine("a\nb\nc", 3)).toBe(4);
  });

  it("clamps past the last line to the end of the document", () => {
    expect(offsetAtLine("a\nb", 9)).toBe(3);
  });
});

describe("lineAtOffset", () => {
  it("returns the 1-based line that contains the offset", () => {
    expect(lineAtOffset("a\nb\nc", 0)).toBe(1);
    expect(lineAtOffset("a\nb\nc", 2)).toBe(2);
    expect(lineAtOffset("a\nb\nc", 4)).toBe(3);
  });

  it("counts a newline as the start of the next line", () => {
    expect(lineAtOffset("a\nb", 1)).toBe(1);
    expect(lineAtOffset("a\nb", 2)).toBe(2);
  });
});

describe("linesPerPage", () => {
  it("steps one screen of lines minus one for overlap", () => {
    expect(linesPerPage(800, 16)).toBe(49);
  });

  it("always moves at least one line", () => {
    expect(linesPerPage(16, 16)).toBe(1);
  });
});

describe("offsetAfterPage", () => {
  it("moves the caret down by a page of visual lines", () => {
    expect(offsetAfterPage("a\nb\nc\nd\ne", 0, 1, 2, 65)).toBe(4);
  });

  it("moves the caret up by a page of visual lines", () => {
    expect(offsetAfterPage("a\nb\nc\nd\ne", 8, -1, 2, 65)).toBe(4);
  });

  it("keeps the column on the target line", () => {
    expect(offsetAfterPage("aaa\nbbb\nccc", 2, 1, 1, 65)).toBe(6);
  });

  it("clamps to the document start and end", () => {
    expect(offsetAfterPage("a\nb", 2, -1, 9, 65)).toBe(0);
    expect(offsetAfterPage("a\nb", 0, 1, 9, 65)).toBe(2);
  });

  it("counts wrapped segments as visual lines", () => {
    expect(offsetAfterPage("abcdefgh\nxy", 0, 1, 1, 4)).toBe(4);
  });
});
