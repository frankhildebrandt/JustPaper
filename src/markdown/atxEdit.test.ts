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

  it("starts a heading on any empty line, not only in an empty document", () => {
    expect(addAtxHash("", 0)).toEqual({ from: 0, to: 0, insert: "# ", caret: 2 });
    expect(addAtxHash("one\n\ntwo", 4)).toEqual({
      from: 4,
      to: 4,
      insert: "# ",
      caret: 6,
    });
    expect(addAtxHash("one\n", 4)).toEqual({
      from: 4,
      to: 4,
      insert: "# ",
      caret: 6,
    });
  });

  it("does not start a heading on an empty line inside a code block", () => {
    expect(addAtxHash("```\n\n```", 4)).toBeUndefined();
    expect(addAtxHash("```\n", 4)).toBeUndefined();
  });

  it("starts a heading on the empty line right after a closed code block", () => {
    expect(addAtxHash("```\nx\n```\n\nafter", 10)).toEqual({
      from: 10,
      to: 10,
      insert: "# ",
      caret: 12,
    });
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

  it("leaves Backspace before a visible hash to the default line join", () => {
    expect(removeAtxHash("intro\n# Title", 6)).toBeUndefined();
    expect(removeAtxHash("intro\n## Title", 6)).toBeUndefined();
  });

  it("still removes a hash when the caret sits after the prefix", () => {
    expect(removeAtxHash("intro\n# Title", 8)).toEqual({
      from: 6,
      to: 8,
      insert: "",
      caret: 6,
    });
  });
});
