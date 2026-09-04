import {
  EditorSelection,
  type EditorState,
  findClusterBreak,
  type SelectionRange,
} from "@codemirror/state";

/**
 * Returns the standard text-editor selection unit for a pointer click.
 * A double click selects the character group (word, whitespace, or
 * punctuation). Triple-click visual rows are resolved separately below.
 */
export function pointerRangeAt(
  state: EditorState,
  position: number,
  clickCount: 1 | 2,
  bias = 1,
): SelectionRange {
  const pos = Math.max(0, Math.min(position, state.doc.length));
  if (clickCount <= 1) {
    return EditorSelection.cursor(pos, bias);
  }
  return characterGroupAt(state, pos, bias);
}

/** Joins the selection units at the start and current drag positions. */
export function spanPointerRanges(
  start: SelectionRange,
  current: SelectionRange,
  startPos = start.head,
  currentPos = current.head,
): SelectionRange {
  if (currentPos === startPos) {
    return start;
  }
  const from = Math.min(start.from, current.from);
  const to = Math.max(start.to, current.to);
  if (currentPos < startPos) {
    return EditorSelection.range(to, from);
  }
  return EditorSelection.range(from, to);
}

export type VisualRowHit = {
  pos: number;
  top: number;
  bottom: number;
};

/** Resolves a triple click to the visual (soft-wrapped) row under the pointer. */
export function visualRowRangeAt(
  state: EditorState,
  linePosition: number,
  clientY: number,
  hits: readonly VisualRowHit[],
): SelectionRange {
  const line = state.doc.lineAt(linePosition);
  if (hits.length === 0) {
    const to = line.to < state.doc.length ? line.to + 1 : line.to;
    return EditorSelection.undirectionalRange(line.from, to);
  }

  let target = hits[0];
  let targetDistance = Number.POSITIVE_INFINITY;
  for (const hit of hits) {
    const middle = (hit.top + hit.bottom) / 2;
    const distance = Math.abs(middle - clientY);
    if (distance < targetDistance) {
      target = hit;
      targetDistance = distance;
    }
  }

  const targetMiddle = (target.top + target.bottom) / 2;
  const rowSlack = Math.max(2, (target.bottom - target.top) * 0.45);
  const row = hits.filter(
    (hit) =>
      Math.abs((hit.top + hit.bottom) / 2 - targetMiddle) <= rowSlack,
  );
  const from = Math.max(line.from, Math.min(...row.map((hit) => hit.pos)));
  let to = Math.min(line.to, Math.max(...row.map((hit) => hit.pos)));
  if (to === line.to && line.to < state.doc.length) {
    to += 1;
  }
  return EditorSelection.undirectionalRange(from, to);
}

function characterGroupAt(
  state: EditorState,
  pos: number,
  initialBias: number,
): SelectionRange {
  const categorize = state.charCategorizer(pos);
  const line = state.doc.lineAt(pos);
  const linePos = pos - line.from;
  if (line.length === 0) {
    return EditorSelection.cursor(pos);
  }

  let bias = initialBias;
  if (linePos === 0) {
    bias = 1;
  } else if (linePos === line.length) {
    bias = -1;
  }

  let from = linePos;
  let to = linePos;
  if (bias < 0) {
    from = findClusterBreak(line.text, linePos, false);
  } else {
    to = findClusterBreak(line.text, linePos);
  }
  const category = categorize(line.text.slice(from, to));

  while (from > 0) {
    const previous = findClusterBreak(line.text, from, false);
    if (categorize(line.text.slice(previous, from)) !== category) {
      break;
    }
    from = previous;
  }
  while (to < line.length) {
    const next = findClusterBreak(line.text, to);
    if (categorize(line.text.slice(to, next)) !== category) {
      break;
    }
    to = next;
  }

  return EditorSelection.undirectionalRange(line.from + from, line.from + to);
}
