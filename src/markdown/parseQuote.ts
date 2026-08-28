import { parseCalloutHead } from "./parseCallout";

export type QuoteLineRange = {
  from: number;
  to: number;
  mark: { from: number; to: number };
};

export type QuoteCallout = {
  type: string;
  title: string | undefined;
  fold: "none" | "open" | "closed";
  /** Absolute range of `[!type]` including optional fold mark. */
  marker: { from: number; to: number };
  /** Absolute range of the custom title, if any. */
  titleRange: { from: number; to: number } | undefined;
};

export type QuoteRange = {
  from: number;
  to: number;
  next: number;
  lines: QuoteLineRange[];
  callout: QuoteCallout | undefined;
};

/**
 * Parses consecutive `>` quote lines starting at `from`.
 */
export function parseQuote(
  source: string,
  from: number,
): QuoteRange | undefined {
  const lines: QuoteLineRange[] = [];
  let cursor = from;
  while (cursor <= source.length) {
    const newlineAt = source.indexOf("\n", cursor);
    const lineEnd = newlineAt === -1 ? source.length : newlineAt;
    if (cursor === lineEnd || source[cursor] !== ">") {
      break;
    }
    const afterGt = cursor + 1;
    const markTo =
      afterGt < lineEnd && source[afterGt] === " " ? afterGt + 1 : afterGt;
    lines.push({ from: cursor, to: lineEnd, mark: { from: cursor, to: markTo } });
    if (newlineAt === -1) {
      cursor = lineEnd;
      break;
    }
    cursor = newlineAt + 1;
  }
  if (lines.length === 0) {
    return undefined;
  }
  const last = lines[lines.length - 1];
  return {
    from,
    to: last.to,
    next: cursor,
    lines,
    callout: calloutFromFirstLine(source, lines[0]),
  };
}

function calloutFromFirstLine(
  source: string,
  line: QuoteLineRange,
): QuoteCallout | undefined {
  const content = source.slice(line.mark.to, line.to);
  const head = parseCalloutHead(content);
  if (!head) {
    return undefined;
  }
  const markerFrom = line.mark.to;
  const markerTo = markerFrom + head.markerTo;
  const titleRange =
    head.title === undefined
      ? undefined
      : {
          from: markerTo + (source[markerTo] === " " ? 1 : 0),
          to: line.to,
        };
  return {
    type: head.type,
    title: head.title,
    fold: head.fold,
    marker: { from: markerFrom, to: markerTo },
    titleRange,
  };
}
