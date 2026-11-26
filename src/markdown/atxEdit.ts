import { parseMarkdown, type Block, type HeadingBlock } from "./parse";

export type AtxEdit = {
  from: number;
  to: number;
  insert: string;
  caret: number;
};

/**
 * Inserts one ATX hash at the start of the line under the caret. Typing `#`
 * at the start of a paragraph or on an empty line starts a level-1 heading.
 * `blocks` may be passed when the caller already parsed `source`.
 */
export function addAtxHash(
  source: string,
  pos: number,
  blocks: Block[] = parseMarkdown(source),
): AtxEdit | undefined {
  const block = blockAt(source, blocks, pos);
  if (!block) {
    return isEmptyLine(source, pos) ? startHeading(pos) : undefined;
  }
  if (block.kind === "heading") {
    if (!isHeadingPrefix(block, pos) || block.level >= 6) {
      return undefined;
    }
    return {
      from: block.atxFrom,
      to: block.atxFrom,
      insert: "#",
      caret: pos + 1,
    };
  }
  if (block.kind !== "paragraph" || pos !== block.from) {
    return undefined;
  }
  return startHeading(block.from);
}

/**
 * Removes one ATX hash from the heading under the caret. A caret before the
 * visible `#` is left to the default Backspace, which joins with the previous line.
 * `blocks` may be passed when the caller already parsed `source`.
 */
export function removeAtxHash(
  source: string,
  pos: number,
  blocks: Block[] = parseMarkdown(source),
): AtxEdit | undefined {
  const block = blockAt(source, blocks, pos);
  if (
    !block ||
    block.kind !== "heading" ||
    pos === block.from ||
    !isHeadingPrefix(block, pos)
  ) {
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

function startHeading(at: number): AtxEdit {
  return { from: at, to: at, insert: "# ", caret: at + 2 };
}

/**
 * Finds the block owning `pos`. A closed multi-line block whose range ends
 * with its trailing newline does not own the start of the following line.
 */
function blockAt(
  source: string,
  blocks: Block[],
  pos: number,
): Block | undefined {
  return blocks.find(
    (block) =>
      pos >= block.from &&
      (pos < block.to || (pos === block.to && !endsWithClosedLine(source, block))),
  );
}

function endsWithClosedLine(source: string, block: Block): boolean {
  const unclosedFence = block.kind === "codeblock" && block.close === undefined;
  return source[block.to - 1] === "\n" && !unclosedFence;
}

function isEmptyLine(source: string, pos: number): boolean {
  const atLineStart = pos === 0 || source[pos - 1] === "\n";
  const atLineEnd = pos === source.length || source[pos] === "\n";
  return atLineStart && atLineEnd;
}

function isHeadingPrefix(block: HeadingBlock, pos: number): boolean {
  return pos >= block.from && pos <= block.atxTo + 1;
}
