import { StateEffect, StateField } from "@codemirror/state";

/**
 * Records the screen x a vertical caret move aims for. Attach it to every
 * transaction of a vertical move so consecutive moves keep the column.
 */
export const setGoalColumn = StateEffect.define<number>();

/**
 * Per-editor goal column (screen x) for vertical caret motion. Set by vertical
 * moves, kept while they continue, and cleared by any other selection change
 * (click, horizontal move) or edit.
 */
export const goalColumnField = StateField.define<number | undefined>({
  create: () => undefined,
  update(value, transaction): number | undefined {
    for (const effect of transaction.effects) {
      if (effect.is(setGoalColumn)) {
        return effect.value;
      }
    }
    return transaction.docChanged || transaction.selection ? undefined : value;
  },
});
