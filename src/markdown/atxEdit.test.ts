import { describe, expect, it } from "vitest";
import { addAtxHash, removeAtxHash } from "./atxEdit";

describe("addAtxHash", () => {
  it("turns a paragraph into a first-level heading", () => {
    expect(addAtxHash("Hello", 0)).toEqual({
      from: 0,
      to: 0,
      insert: "# ",
      caret: 2,
    });
  });

  it("adds a hash to an existing heading without inserting another space", () => {
    expect(addAtxHash("# Title", 2)).toEqual({
      from: 0,
      to: 0,
      insert: "#",
      caret: 3,
    });
  });

  it("does not add a seventh hash", () => {
    expect(addAtxHash("###### Title", 0)).toBeUndefined();
  });

  it("does not add a hash in the middle of a line", () => {
    expect(addAtxHash("Hello", 3)).toBeUndefined();
  });
});

describe("removeAtxHash", () => {
  it("turns a first-level heading back into a paragraph", () => {
    expect(removeAtxHash("# Title", 2)).toEqual({
      from: 0,
      to: 2,
      insert: "",
      caret: 0,
    });
  });

  it("drops one hash from a deeper heading", () => {
    expect(removeAtxHash("## Title", 3)).toEqual({
      from: 0,
      to: 1,
      insert: "",
      caret: 2,
    });
  });
});
