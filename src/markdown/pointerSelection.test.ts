import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  pointerRangeAt,
  spanPointerRanges,
  visualRowRangeAt,
} from "./pointerSelection";

describe("pointerRangeAt", () => {
  const state = EditorState.create({ doc: "Hello, brave world!\nSecond line" });

  it("places a caret for a single click", () => {
    expect(pointerRangeAt(state, 8, 1)).toMatchObject({ from: 8, to: 8 });
  });

  it("selects the complete word on double click", () => {
    expect(pointerRangeAt(state, 9, 2)).toMatchObject({ from: 7, to: 12 });
  });

  it("selects adjacent punctuation and whitespace groups like a native editor", () => {
    expect(pointerRangeAt(state, 5, 2)).toMatchObject({ from: 5, to: 6 });
    expect(pointerRangeAt(state, 6, 2)).toMatchObject({ from: 6, to: 7 });
  });

  it("uses the preceding group at the end of a line", () => {
    expect(pointerRangeAt(state, 19, 2)).toMatchObject({ from: 18, to: 19 });
  });

  it("honors the click side at a word boundary", () => {
    const boundary = EditorState.create({ doc: "one two" });

    expect(pointerRangeAt(boundary, 3, 2, -1)).toMatchObject({
      from: 0,
      to: 3,
    });
    expect(pointerRangeAt(boundary, 3, 2, 1)).toMatchObject({
      from: 3,
      to: 4,
    });
  });
});

describe("spanPointerRanges", () => {
  it("extends word selection by complete groups in both directions", () => {
    const state = EditorState.create({ doc: "one two three" });
    const two = pointerRangeAt(state, 5, 2);
    const three = pointerRangeAt(state, 10, 2);
    const one = pointerRangeAt(state, 1, 2);

    expect(spanPointerRanges(two, three, 5, 10)).toMatchObject({
      anchor: 4,
      head: 13,
    });
    expect(spanPointerRanges(two, one, 5, 1)).toMatchObject({
      anchor: 7,
      head: 0,
    });
  });

  it("preserves drag direction within one selected word", () => {
    const state = EditorState.create({ doc: "word" });
    const word = pointerRangeAt(state, 2, 2);

    expect(spanPointerRanges(word, word, 2, 1)).toMatchObject({
      anchor: 4,
      head: 0,
    });
    expect(spanPointerRanges(word, word, 2, 3)).toMatchObject({
      anchor: 0,
      head: 4,
    });
  });

  it("preserves the association of an unmoved caret", () => {
    const state = EditorState.create({ doc: "word" });
    const caret = pointerRangeAt(state, 2, 1, -1);

    expect(spanPointerRanges(caret, caret, 2, 2).assoc).toBe(-1);
  });
});

describe("visualRowRangeAt", () => {
  it("selects only the clicked soft-wrapped row", () => {
    const state = EditorState.create({ doc: "abcdefghij\nnext" });
    const hits = [
      ...Array.from({ length: 6 }, (_, pos) => ({ pos, top: 0, bottom: 20 })),
      ...Array.from({ length: 6 }, (_, index) => ({
        pos: index + 5,
        top: 20,
        bottom: 40,
      })),
    ];

    expect(visualRowRangeAt(state, 7, 30, hits)).toMatchObject({
      from: 5,
      to: 11,
    });
    expect(visualRowRangeAt(state, 2, 10, hits)).toMatchObject({
      from: 0,
      to: 5,
    });
  });
});
