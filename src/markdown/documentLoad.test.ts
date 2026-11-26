import { history, undoDepth } from "@codemirror/commands";
import { Compartment, EditorState, type TransactionSpec } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { loadDocument, replaceDocumentWithFreshHistory } from "./documentLoad";

function recordingTarget(initial: string, caret = 0) {
  const historyCompartment = new Compartment();
  let state = EditorState.create({
    doc: initial,
    selection: { anchor: caret },
    extensions: [historyCompartment.of(history())],
  });
  const docChanges: boolean[] = [];
  const target = {
    get state(): EditorState {
      return state;
    },
    dispatch(spec: TransactionSpec): void {
      const transaction = state.update(spec);
      docChanges.push(transaction.docChanged);
      state = transaction.state;
    },
  };
  return { target, historyCompartment, docChanges };
}

describe("loadDocument", () => {
  it("does not touch the document or undo history when the text is identical", () => {
    const { target, docChanges } = recordingTarget("same", 3);
    target.dispatch({ changes: { from: 4, insert: "!" } });
    docChanges.length = 0;

    loadDocument(target, "same!");

    expect(docChanges).toEqual([]);
    expect(target.state.selection.main.head).toBe(3);
    expect(undoDepth(target.state)).toBe(1);
  });

  it("only moves the caret for identical text when a caret is given", () => {
    const { target, docChanges } = recordingTarget("one\ntwo", 0);

    loadDocument(target, "one\ntwo", 4);

    expect(docChanges).toEqual([false]);
    expect(target.state.selection.main.head).toBe(4);
  });

  it("replaces differing text and clamps the caret", () => {
    const { target } = recordingTarget("old");

    loadDocument(target, "new text", 99);

    expect(target.state.doc.toString()).toBe("new text");
    expect(target.state.selection.main.head).toBe(8);
  });
});

describe("replaceDocumentWithFreshHistory with identical text", () => {
  it("drops history without a document change", () => {
    const { target, historyCompartment, docChanges } = recordingTarget("same");
    target.dispatch({ changes: { from: 4, insert: "!" } });
    docChanges.length = 0;

    replaceDocumentWithFreshHistory(target, historyCompartment, "same!");

    expect(docChanges.every((changed) => !changed)).toBe(true);
    expect(undoDepth(target.state)).toBe(0);
    expect(target.state.doc.toString()).toBe("same!");
  });
});
