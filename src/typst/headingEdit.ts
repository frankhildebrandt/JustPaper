import type { Block, HeadingBlock } from "./parse";
import { parseTypst } from "./parse";

export type HeadingEdit = {
  from: number;
  to: number;
  insert: string;
  caret: number;
};

/**
 * Inserts one heading equals-sign at the start of the line under the caret.
 */
export function addHeadingMark(
  source: string,
  pos: number,
): HeadingEdit | undefined {
  const block = blockAt(parseTypst(source), pos);
  if (!block) {
    if (source.length === 0 && pos === 0) {
      return { from: 0, to: 0, insert: "= ", caret: 2 };
    }
    return undefined;
  }
  if (block.kind === "heading") {
    if (!isHeadingPrefix(block, pos) || block.level >= 6) {
      return undefined;
    }
    return {
      from: block.atxFrom,
      to: block.atxFrom,
      insert: "=",
      caret: pos + 1,
    };
  }
  if (block.kind !== "paragraph" || pos !== block.from) {
    return undefined;
  }
  return {
    from: block.from,
    to: block.from,
    insert: "= ",
    caret: block.from + 2,
  };
}

/**
 * Removes one heading equals-sign at the start of the heading under the caret.
 */
export function removeHeadingMark(
  source: string,
  pos: number,
): HeadingEdit | undefined {
  const block = blockAt(parseTypst(source), pos);
  if (!block || block.kind !== "heading" || !isHeadingPrefix(block, pos)) {
    return undefined;
  }
  if (block.level === 1) {
    return {
      from: block.from,
      to: block.atxTo + 1,
      insert: "",
      caret: block.from,
    };
  }
  return {
    from: block.atxFrom,
    to: block.atxFrom + 1,
    insert: "",
    caret: Math.max(block.from, pos - 1),
  };
}

function blockAt(blocks: Block[], pos: number): Block | undefined {
  return blocks.find((block) => pos >= block.from && pos <= block.to);
}

function isHeadingPrefix(block: HeadingBlock, pos: number): boolean {
  return pos >= block.from && pos <= block.atxTo + 1;
}
