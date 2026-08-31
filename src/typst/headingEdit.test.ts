import { describe, expect, it } from "vitest";
import { addHeadingMark, removeHeadingMark } from "./headingEdit";

describe("addHeadingMark", () => {
  it("turns a paragraph into a first-level heading", () => {
    expect(addHeadingMark("Hello", 0)).toEqual({
      from: 0,
      to: 0,
      insert: "= ",
      caret: 2,
    });
  });

  it("adds an equals mark without inserting another space", () => {
    expect(addHeadingMark("= Title", 2)).toEqual({
      from: 0,
      to: 0,
      insert: "=",
      caret: 3,
    });
  });

  it("does not add a seventh equals mark", () => {
    expect(addHeadingMark("====== Title", 0)).toBeUndefined();
  });

  it("does not add a mark in the middle of a line", () => {
    expect(addHeadingMark("Hello", 3)).toBeUndefined();
  });
});

describe("removeHeadingMark", () => {
  it("turns a first-level heading back into a paragraph", () => {
    expect(removeHeadingMark("= Title", 2)).toEqual({
      from: 0,
      to: 2,
      insert: "",
      caret: 0,
    });
  });

  it("drops one mark from a deeper heading", () => {
    expect(removeHeadingMark("== Title", 3)).toEqual({
      from: 0,
      to: 1,
      insert: "",
      caret: 2,
    });
  });
});
