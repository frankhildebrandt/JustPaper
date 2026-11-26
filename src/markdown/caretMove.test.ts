import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { caretMoveSpec, logicalDirection } from "./caretMove";
import { goalColumnField } from "./goalColumn";

describe("caretMoveSpec", () => {
  it("scrolls the moved caret into view as a select event", () => {
    const state = EditorState.create({ doc: "abc\ndef" });
    const transaction = state.update(caretMoveSpec(5));
    expect(transaction.selection?.main.head).toBe(5);
    expect(transaction.scrollIntoView).toBe(true);
    expect(transaction.isUserEvent("select")).toBe(true);
  });

  it("carries the goal column of a vertical move", () => {
    const state = EditorState.create({
      doc: "abc\ndef",
      extensions: [goalColumnField],
    });
    const next = state.update(caretMoveSpec(5, 42)).state;
    expect(next.field(goalColumnField)).toBe(42);
    expect(state.update(caretMoveSpec(1)).state.field(goalColumnField)).toBe(
      undefined,
    );
  });
});

describe("logicalDirection", () => {
  it("keeps the arrow direction in left-to-right text", () => {
    expect(logicalDirection(1, false)).toBe(1);
    expect(logicalDirection(-1, false)).toBe(-1);
  });

  it("flips the arrow direction in right-to-left text", () => {
    expect(logicalDirection(1, true)).toBe(-1);
    expect(logicalDirection(-1, true)).toBe(1);
  });
});
