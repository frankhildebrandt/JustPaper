import { history } from "@codemirror/commands";
import type {
  Compartment,
  EditorState,
  Text,
  TransactionSpec,
} from "@codemirror/state";
import { docSource } from "./parsedDoc";

export type DocumentTarget = {
  readonly state: EditorState;
  dispatch: (spec: TransactionSpec) => void;
};

/**
 * Builds the changes and selection that load `text` over `current`.
 * Identical text yields no change, so undo history, change listeners and the
 * caret stay untouched; `caret` (clamped to the text) is applied when given.
 */
export function documentLoadSpec(
  current: Text,
  text: string,
  caret?: number,
): Pick<TransactionSpec, "changes" | "selection"> {
  const identical =
    current.length === text.length && docSource(current) === text;
  return {
    changes: identical
      ? undefined
      : { from: 0, to: current.length, insert: text },
    selection:
      caret === undefined
        ? undefined
        : { anchor: Math.min(Math.max(caret, 0), text.length) },
  };
}

/**
 * Loads `text` while keeping undo history. Dispatches nothing when the text is
 * identical and no caret is requested.
 */
export function loadDocument(
  target: DocumentTarget,
  text: string,
  caret?: number,
): void {
  const spec = documentLoadSpec(target.state.doc, text, caret);
  if (spec.changes === undefined && spec.selection === undefined) {
    return;
  }
  target.dispatch(spec);
}

/**
 * Replaces the complete buffer while dropping history from the previous
 * document (also when the text is identical). Removing and re-adding the
 * compartment is intentional: marking the replacement as non-historical would
 * still map old undo entries through the new document and can splice
 * unrelated file contents together.
 */
export function replaceDocumentWithFreshHistory(
  target: DocumentTarget,
  historyCompartment: Compartment,
  text: string,
  caret?: number,
): void {
  target.dispatch({
    ...documentLoadSpec(target.state.doc, text, caret),
    effects: historyCompartment.reconfigure([]),
  });
  target.dispatch({ effects: historyCompartment.reconfigure(history()) });
}
