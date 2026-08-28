export type TodoRange = {
  from: number;
  to: number;
  listMark: { from: number; to: number };
  box: { from: number; to: number };
  checked: boolean;
  contentFrom: number;
};

export type TodoToggle = {
  from: number;
  to: number;
  insert: string;
};

const TODO_LINE = /^[-*+] \[([ xX])\]( |$)/;

/**
 * Parses a GFM task line `- [ ]` / `- [x]` between `from` and `to`.
 */
export function parseTodo(
  source: string,
  from: number,
  to: number,
): TodoRange | undefined {
  const line = source.slice(from, to);
  const match = TODO_LINE.exec(line);
  if (!match) {
    return undefined;
  }
  const inner = match[1];
  const boxFrom = from + 2;
  const boxTo = boxFrom + 3;
  const afterBox = boxTo < to && source[boxTo] === " " ? boxTo + 1 : boxTo;
  return {
    from,
    to,
    listMark: { from, to: boxFrom },
    box: { from: boxFrom, to: boxTo },
    checked: inner === "x" || inner === "X",
    contentFrom: afterBox,
  };
}

/**
 * Flips the task box at `pos` (`[` of `[ ]` / `[x]`, or a position inside it).
 */
export function toggleTodoCheck(
  source: string,
  pos: number,
): TodoToggle | undefined {
  for (const start of [pos, pos - 1, pos - 2]) {
    if (start < 0) {
      continue;
    }
    const box = source.slice(start, start + 3);
    if (box === "[ ]") {
      return { from: start + 1, to: start + 2, insert: "x" };
    }
    if (box === "[x]" || box === "[X]") {
      return { from: start + 1, to: start + 2, insert: " " };
    }
  }
  return undefined;
}
