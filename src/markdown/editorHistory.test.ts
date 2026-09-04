import { history, undo, undoDepth } from "@codemirror/commands";
import { Compartment, EditorState, type TransactionSpec } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { replaceDocumentWithFreshHistory } from "./editor";

function stateTarget(initial: string) {
  const historyCompartment = new Compartment();
  let state = EditorState.create({
    doc: initial,
    extensions: [historyCompartment.of(history())],
  });
  const target = {
    get state(): EditorState {
      return state;
    },
    dispatch(spec: TransactionSpec): void {
      state = state.update(spec).state;
    },
  };
  return { target, historyCompartment };
}

describe("replaceDocumentWithFreshHistory", () => {
  it("does not let undo restore content from the previous document", () => {
    const { target, historyCompartment } = stateTarget("file A");
    target.dispatch({
      changes: { from: 6, insert: " edited" },
    });

    replaceDocumentWithFreshHistory(
      target,
      historyCompartment,
      "file B",
      0,
    );

    expect(target.state.doc.toString()).toBe("file B");
    expect(target.state.selection.main.head).toBe(0);
    expect(undoDepth(target.state)).toBe(0);
    expect(undo(target)).toBe(false);
    expect(target.state.doc.toString()).toBe("file B");
  });

  it("starts a new undo history after the replacement", () => {
    const { target, historyCompartment } = stateTarget("file A");
    replaceDocumentWithFreshHistory(target, historyCompartment, "file B");
    target.dispatch({ changes: { from: 6, insert: " edited" } });

    expect(undo(target)).toBe(true);
    expect(target.state.doc.toString()).toBe("file B");
    expect(undo(target)).toBe(false);
  });

  it("clears history even when two documents have identical text", () => {
    const { target, historyCompartment } = stateTarget("same text");
    target.dispatch({ changes: { from: 4, to: 9, insert: " draft" } });

    replaceDocumentWithFreshHistory(
      target,
      historyCompartment,
      "same text",
    );

    expect(undoDepth(target.state)).toBe(0);
    expect(undo(target)).toBe(false);
    expect(target.state.doc.toString()).toBe("same text");
  });
});
