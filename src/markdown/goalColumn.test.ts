import { EditorState, StateEffect } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { goalColumnField, setGoalColumn } from "./goalColumn";

const otherEffect = StateEffect.define<null>();

function stateWithGoal(x: number): EditorState {
  return EditorState.create({ doc: "abc\n\nlonger line", extensions: [goalColumnField] })
    .update({ selection: { anchor: 0 }, effects: setGoalColumn.of(x) }).state;
}

describe("goalColumnField", () => {
  it("starts without a goal column", () => {
    const state = EditorState.create({ extensions: [goalColumnField] });
    expect(state.field(goalColumnField)).toBeUndefined();
  });

  it("keeps the goal across consecutive vertical moves", () => {
    const next = stateWithGoal(120).update({
      selection: { anchor: 4 },
      effects: setGoalColumn.of(120),
    }).state;
    expect(next.field(goalColumnField)).toBe(120);
  });

  it("clears the goal on a selection change without a vertical move", () => {
    const next = stateWithGoal(120).update({ selection: { anchor: 2 } }).state;
    expect(next.field(goalColumnField)).toBeUndefined();
  });

  it("clears the goal on edits", () => {
    const next = stateWithGoal(120).update({
      changes: { from: 0, insert: "x" },
    }).state;
    expect(next.field(goalColumnField)).toBeUndefined();
  });

  it("keeps the goal across unrelated transactions", () => {
    const next = stateWithGoal(120).update({
      effects: otherEffect.of(null),
    }).state;
    expect(next.field(goalColumnField)).toBe(120);
  });
});
