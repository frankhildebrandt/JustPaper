import { describe, expect, it } from "vitest";
import { displayOffsetToSource } from "./cellClick";
import {
  caretRevealsTable,
  caretSkippedGraphic,
  enterGraphicAcross,
  enterGraphicAlong,
  graphicEnterEnd,
  tableClickPos,
  tableWidgetRange,
  type GraphicSpan,
} from "./graphicNav";
import { parseMarkdown } from "./parse";
import { cellContentRanges, parseTable } from "./parseTable";

/**
 * Deterministic PRNG so failures are reproducible.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

type CellCase = {
  source: string;
  display: string;
  /** sourceAtDisplay[d] is the expected source index for display offset d. */
  sourceAtDisplay: number[];
};

function randomWord(rand: () => number, max = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const length = 1 + Math.floor(rand() * max);
  let out = "";
  for (let index = 0; index < length; index += 1) {
    out += alphabet[Math.floor(rand() * alphabet.length)];
  }
  return out;
}

/**
 * Builds a cell with an independent expected source map (not derived from the parser).
 */
function randomCell(rand: () => number): CellCase {
  let source = "";
  let display = "";
  const sourceAtDisplay: number[] = [];

  const pushPlain = (text: string) => {
    for (const char of text) {
      sourceAtDisplay.push(source.length);
      source += char;
      display += char;
    }
  };

  const pushCode = (text: string) => {
    source += "`";
    for (const char of text) {
      sourceAtDisplay.push(source.length);
      source += char;
      display += char;
    }
    source += "`";
  };

  const pushStrong = (text: string) => {
    source += "**";
    for (const char of text) {
      sourceAtDisplay.push(source.length);
      source += char;
      display += char;
    }
    source += "**";
  };

  const pushEm = (text: string) => {
    source += "*";
    for (const char of text) {
      sourceAtDisplay.push(source.length);
      source += char;
      display += char;
    }
    source += "*";
  };

  const pushStrongCode = (text: string) => {
    source += "**`";
    for (const char of text) {
      sourceAtDisplay.push(source.length);
      source += char;
      display += char;
    }
    source += "`**";
  };

  const pushLink = (label: string) => {
    source += "[";
    for (const char of label) {
      sourceAtDisplay.push(source.length);
      source += char;
      display += char;
    }
    source += "](http://ex.test/" + label + ")";
  };

  const pushWiki = (label: string) => {
    source += "[[";
    for (const char of label) {
      sourceAtDisplay.push(source.length);
      source += char;
      display += char;
    }
    source += "]]";
  };

  const count = 1 + Math.floor(rand() * 4);
  for (let index = 0; index < count; index += 1) {
    // Always separate frags so mark delimiters cannot fuse across boundaries.
    if (index > 0) {
      pushPlain(" ");
    }
    const word = randomWord(rand);
    const roll = rand();
    if (roll < 0.18) {
      pushPlain(word);
    } else if (roll < 0.34) {
      pushCode(word);
    } else if (roll < 0.48) {
      pushStrong(word);
    } else if (roll < 0.6) {
      pushEm(word);
    } else if (roll < 0.72) {
      pushStrongCode(word);
    } else if (roll < 0.86) {
      pushLink(word);
    } else {
      pushWiki(word);
    }
  }
  sourceAtDisplay.push(source.length);
  return { source, display, sourceAtDisplay };
}

function graphicSpansIn(source: string): GraphicSpan[] {
  return parseMarkdown(source)
    .filter(
      (block) =>
        block.kind === "table" ||
        block.kind === "codeblock" ||
        block.kind === "hr",
    )
    .map((block) => ({ from: block.from, to: block.to }));
}

function jumpsOver(
  source: string,
  span: GraphicSpan,
  from: number,
  to: number,
): boolean {
  const range = tableWidgetRange(source, span);
  return (
    (from < range.from && to >= range.to) ||
    (to < range.from && from >= range.to)
  );
}

function lineStart(source: string, caret: number): number {
  if (caret <= 0) {
    return 0;
  }
  const newline = source.lastIndexOf("\n", caret - 1);
  return newline === -1 ? 0 : newline + 1;
}

function nextLineStart(source: string, caret: number): number {
  const newline = source.indexOf("\n", caret);
  return newline === -1 ? source.length : newline + 1;
}

function restOfLineIsBlank(source: string, caret: number): boolean {
  const newline = source.indexOf("\n", caret);
  const lineTo = newline === -1 ? source.length : newline;
  return source.slice(caret, lineTo).trim().length === 0;
}

/**
 * Models CM atomic-widget vertical motion: landing on a widget jumps past it.
 */
function cmSkipVertical(
  source: string,
  spans: GraphicSpan[],
  caret: number,
  direction: 1 | -1,
): number {
  if (direction === 1) {
    let pos = nextLineStart(source, caret);
    for (const span of spans) {
      const range = tableWidgetRange(source, span);
      if (pos >= range.from && pos < range.to) {
        return range.to;
      }
    }
    return pos;
  }
  const start = lineStart(source, caret);
  if (start === 0) {
    return 0;
  }
  let pos = lineStart(source, start - 1);
  for (const span of spans) {
    const range = tableWidgetRange(source, span);
    if (pos >= range.from && pos < range.to) {
      return range.from;
    }
  }
  return pos;
}

/**
 * Same decision order as editor enterGraphic for ArrowUp/Down.
 */
function resolveAlong(
  source: string,
  spans: GraphicSpan[],
  caret: number,
  direction: 1 | -1,
): number | undefined {
  return (
    enterGraphicAlong(source, spans, caret, direction) ??
    caretSkippedGraphic(
      source,
      spans,
      caret,
      cmSkipVertical(source, spans, caret, direction),
    )
  );
}

/**
 * Same decision order as editor enterGraphic for ArrowLeft/Right.
 */
function resolveAcross(
  source: string,
  spans: GraphicSpan[],
  caret: number,
  direction: 1 | -1,
): number | undefined {
  const probe = Math.max(
    0,
    Math.min(source.length, caret + direction),
  );
  return (
    enterGraphicAcross(source, spans, caret, direction) ??
    caretSkippedGraphic(source, spans, caret, probe)
  );
}

function randomBlankRun(rand: () => number): string {
  const count = Math.floor(rand() * 4);
  return "\n".repeat(count);
}

function randomDoc(rand: () => number): string {
  const chunks: string[] = [rand() < 0.3 ? "" : "intro"];
  const blocks = 1 + Math.floor(rand() * 5);
  for (let index = 0; index < blocks; index += 1) {
    chunks.push(randomBlankRun(rand));
    chunks.push("\n");
    const roll = rand();
    if (roll < 0.4) {
      chunks.push(randomTable(rand));
    } else if (roll < 0.65) {
      chunks.push("---");
    } else if (roll < 0.85) {
      chunks.push("```\ncode\nline\n```");
    } else {
      chunks.push("```ts\nconst x = 1\n```");
    }
    chunks.push(randomBlankRun(rand));
    chunks.push(rand() < 0.5 ? "\nmid" : "\nmiddle text here");
  }
  chunks.push("\nend");
  return chunks.join("");
}

function randomTable(rand: () => number): string {
  const cols = 1 + Math.floor(rand() * 3);
  const rows = 1 + Math.floor(rand() * 3);
  const header = Array.from({ length: cols }, () => randomWord(rand, 5));
  const body = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => {
      if (rand() < 0.1) {
        return "";
      }
      const cell = randomCell(rand);
      return cell.source.replace(/\|/g, "x");
    }),
  );
  const head = `| ${header.join(" | ")} |`;
  const delim = `| ${header.map(() => "---").join(" | ")} |`;
  const lines = body.map((row) => `| ${row.join(" | ")} |`);
  return [head, delim, ...lines].join("\n");
}

describe("fuzzy cell click mapping", () => {
  it("maps every display offset to the generator's expected source index", () => {
    const rand = mulberry32(0xc11c);
    const failures: string[] = [];
    for (let trial = 0; trial < 400; trial += 1) {
      const cell = randomCell(rand);
      for (let display = 0; display <= cell.display.length; display += 1) {
        const got = displayOffsetToSource(cell.source, display);
        const want = cell.sourceAtDisplay[display];
        if (got !== want) {
          failures.push(
            `trial ${trial} d=${display}: got ${got} want ${want} cell=${JSON.stringify(cell)}`,
          );
        }
      }
      const past = displayOffsetToSource(
        cell.source,
        cell.display.length + 10 + Math.floor(rand() * 40),
      );
      if (past !== cell.source.length) {
        failures.push(
          `trial ${trial}: past-end got ${past} want ${cell.source.length}`,
        );
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  });

  it("is monotonic in the display offset", () => {
    const rand = mulberry32(0x60f0);
    const failures: string[] = [];
    for (let trial = 0; trial < 200; trial += 1) {
      const cell = randomCell(rand);
      let prev = -1;
      for (let display = 0; display <= cell.display.length; display += 1) {
        const got = displayOffsetToSource(cell.source, display);
        if (got < prev) {
          failures.push(
            `trial ${trial}: non-monotonic at d=${display} (${prev} -> ${got})`,
          );
        }
        prev = got;
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it("lands every table-cell click inside that cell and reveals the table", () => {
    const rand = mulberry32(0xce11);
    const failures: string[] = [];
    for (let trial = 0; trial < 120; trial += 1) {
      const before = rand() < 0.5 ? "lead\n\n" : "lead\n";
      const table = randomTable(rand);
      const doc = `${before}${table}\nafter`;
      const parsed = parseTable(doc, before.length);
      if (!parsed) {
        failures.push(`trial ${trial}: not parsed`);
        continue;
      }
      const span = { from: parsed.from, to: parsed.to };
      const rows = [parsed.header, ...parsed.rows];
      for (let row = 0; row < rows.length; row += 1) {
        const cells = cellContentRanges(doc, rows[row]);
        for (let col = 0; col < cells.length; col += 1) {
          const cell = cells[col];
          const cellSource = doc.slice(cell.from, cell.to);
          const clickBase = tableClickPos(doc, parsed, row, col);
          if (clickBase !== cell.from) {
            failures.push(
              `trial ${trial} r${row}c${col}: tableClickPos ${clickBase} != ${cell.from}`,
            );
          }
          const displayLen = displayOffsetToSource(cellSource, 10_000);
          // Probe every display slot including end via a generous upper bound.
          for (let d = 0; d <= Math.min(cellSource.length, 40); d += 1) {
            const pos = cell.from + displayOffsetToSource(cellSource, d);
            if (pos < cell.from || pos > cell.to) {
              failures.push(
                `trial ${trial} r${row}c${col} d=${d}: pos ${pos} outside ${cell.from}-${cell.to} (${cellSource})`,
              );
            }
            if (!caretRevealsTable(doc, span, pos)) {
              failures.push(
                `trial ${trial} r${row}c${col} d=${d}: pos ${pos} does not reveal table`,
              );
            }
            if (d > 0 && displayLen === cellSource.length && d > displayLen) {
              break;
            }
          }
        }
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  });
});

describe("fuzzy cursor navigation", () => {
  it("never skips a graphic block when combining along/across/skip helpers", () => {
    const rand = mulberry32(0x4a71);
    const failures: string[] = [];
    for (let trial = 0; trial < 100; trial += 1) {
      const doc = randomDoc(rand);
      const spans = graphicSpansIn(doc);
      if (spans.length === 0) {
        continue;
      }
      for (let caret = 0; caret <= doc.length; caret += 1) {
        for (const direction of [1, -1] as const) {
          const along = enterGraphicAlong(doc, spans, caret, direction);
          if (
            along !== undefined &&
            !spans.some((span) => caretRevealsTable(doc, span, along)) &&
            !spans.some((span) => caretRevealsTable(doc, span, caret))
          ) {
            failures.push(
              `trial ${trial}: along ${direction} from ${caret} -> ${along} does not reveal`,
            );
          }
          const across = enterGraphicAcross(doc, spans, caret, direction);
          if (
            across !== undefined &&
            !spans.some((span) => caretRevealsTable(doc, span, across))
          ) {
            failures.push(
              `trial ${trial}: across ${direction} from ${caret} -> ${across} does not reveal`,
            );
          }
          const probe =
            direction === 1
              ? Math.min(doc.length, caret + 1 + Math.floor(rand() * 80))
              : Math.max(0, caret - 1 - Math.floor(rand() * 80));
          const skipped = caretSkippedGraphic(doc, spans, caret, probe);
          const over = spans.find((span) =>
            jumpsOver(doc, span, caret, probe),
          );
          if (over && skipped === undefined) {
            failures.push(
              `trial ${trial}: jump ${caret}->${probe} over ${over.from}-${over.to} not caught`,
            );
          }
          if (skipped !== undefined) {
            if (!spans.some((span) => caretRevealsTable(doc, span, skipped))) {
              failures.push(
                `trial ${trial}: skip helper ${caret}->${probe} gave ${skipped} outside blocks`,
              );
            }
            for (const span of spans) {
              if (jumpsOver(doc, span, caret, skipped)) {
                failures.push(
                  `trial ${trial}: skip helper still jumps over ${span.from}`,
                );
              }
            }
          }
        }
      }
    }
    expect(failures.slice(0, 15)).toEqual([]);
  });

  it("editor-style resolveAlong never jumps over a graphic and catches CM skips", () => {
    const rand = mulberry32(0xe01);
    const failures: string[] = [];
    for (let trial = 0; trial < 80; trial += 1) {
      const doc = randomDoc(rand);
      const spans = graphicSpansIn(doc);
      if (spans.length === 0) {
        continue;
      }
      for (let caret = 0; caret <= doc.length; caret += 1) {
        for (const direction of [1, -1] as const) {
          const probe = cmSkipVertical(doc, spans, caret, direction);
          const resolved = resolveAlong(doc, spans, caret, direction);
          for (const span of spans) {
            if (jumpsOver(doc, span, caret, probe) && resolved === undefined) {
              failures.push(
                `trial ${trial}: CM skip ${caret}->${probe} over ${span.from} not resolved`,
              );
            }
            if (
              resolved !== undefined &&
              jumpsOver(doc, span, caret, resolved)
            ) {
              failures.push(
                `trial ${trial}: resolveAlong ${caret}->${resolved} still skips ${span.from}`,
              );
            }
          }
          if (
            resolved !== undefined &&
            !spans.some((span) => caretRevealsTable(doc, span, resolved)) &&
            !spans.some((span) => caretRevealsTable(doc, span, caret))
          ) {
            failures.push(
              `trial ${trial}: resolveAlong ${caret}->${resolved} outside blocks`,
            );
          }
        }
      }
    }
    expect(failures.slice(0, 15)).toEqual([]);
  });

  it("does not steal ArrowDown/Up from mid-line positions", () => {
    const rand = mulberry32(0x2a9);
    const failures: string[] = [];
    for (let trial = 0; trial < 80; trial += 1) {
      const doc = randomDoc(rand);
      const spans = graphicSpansIn(doc);
      for (let caret = 0; caret < doc.length; caret += 1) {
        if (restOfLineIsBlank(doc, caret)) {
          continue;
        }
        // Leave from an open graphic edge is intentional, not a mid-line steal.
        if (spans.some((span) => caretRevealsTable(doc, span, caret))) {
          continue;
        }
        // Mid-wrap: remaining line has content — vertical enter must not fire.
        const down = enterGraphicAlong(doc, spans, caret, 1);
        if (down !== undefined) {
          failures.push(
            `trial ${trial}: mid-line down steal at ${caret} -> ${down}`,
          );
        }
        if (caret !== lineStart(doc, caret)) {
          const up = enterGraphicAlong(doc, spans, caret, -1);
          if (up !== undefined) {
            failures.push(
              `trial ${trial}: mid-line up steal at ${caret} -> ${up}`,
            );
          }
        }
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  });

  it("leaves a revealed graphic only from its edge line", () => {
    const rand = mulberry32(0x1551);
    const failures: string[] = [];
    for (let trial = 0; trial < 60; trial += 1) {
      const doc = randomDoc(rand);
      const spans = graphicSpansIn(doc);
      for (const span of spans) {
        const range = tableWidgetRange(doc, span);
        const firstLine = lineStart(doc, range.from);
        const lastLine = lineStart(doc, Math.max(range.from, range.to - 1));
        for (let caret = span.from; caret <= span.to; caret += 1) {
          if (!caretRevealsTable(doc, span, caret)) {
            continue;
          }
          const caretLine = lineStart(doc, caret);
          const down = enterGraphicAlong(doc, spans, caret, 1);
          const up = enterGraphicAlong(doc, spans, caret, -1);
          if (caretLine !== lastLine && down !== undefined) {
            failures.push(
              `trial ${trial}: down leave from interior ${caret} -> ${down}`,
            );
          }
          if (caretLine === lastLine && down !== undefined) {
            if (caretRevealsTable(doc, span, down)) {
              failures.push(
                `trial ${trial}: down leave still inside at ${down}`,
              );
            }
          }
          if (caretLine !== firstLine && up !== undefined) {
            failures.push(
              `trial ${trial}: up leave from interior ${caret} -> ${up}`,
            );
          }
          for (const direction of [1, -1] as const) {
            if (
              enterGraphicAcross(doc, spans, caret, direction) !== undefined
            ) {
              failures.push(
                `trial ${trial}: across intercepts inside ${span.from} at ${caret}`,
              );
            }
          }
        }
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  });

  it("enters from every immediate horizontal neighbor", () => {
    const rand = mulberry32(0xa690);
    const failures: string[] = [];
    for (let trial = 0; trial < 80; trial += 1) {
      const doc = randomDoc(rand);
      const spans = graphicSpansIn(doc);
      for (const span of spans) {
        const range = tableWidgetRange(doc, span);
        if (range.from > 0) {
          const got = resolveAcross(doc, spans, range.from - 1, 1);
          if (got !== span.from) {
            failures.push(
              `trial ${trial}: right into ${span.from} from ${range.from - 1} -> ${got}`,
            );
          }
        }
        const gotLeft = resolveAcross(doc, spans, range.to, -1);
        const wantLeft = graphicEnterEnd(doc, span);
        if (gotLeft !== wantLeft) {
          failures.push(
            `trial ${trial}: left into ${wantLeft} from ${range.to} -> ${gotLeft}`,
          );
        }
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  });

  it("enters every graphic from the line above and below via editor resolve", () => {
    const rand = mulberry32(0x7ab1);
    const failures: string[] = [];
    for (let trial = 0; trial < 100; trial += 1) {
      const blanksBefore = "\n".repeat(1 + Math.floor(rand() * 3));
      const blanksAfter = "\n".repeat(Math.floor(rand() * 3));
      const roll = rand();
      const block =
        roll < 0.4
          ? randomTable(rand)
          : roll < 0.7
            ? "---"
            : "```\ncode\n```";
      const doc = `lead${blanksBefore}${block}\n${blanksAfter}after`;
      const spans = graphicSpansIn(doc);
      if (spans.length !== 1) {
        // Random table/hr/code should yield exactly one graphic here.
        if (spans.length === 0) {
          failures.push(`trial ${trial}: no span in ${JSON.stringify(doc)}`);
        }
        continue;
      }
      const span = spans[0];
      const above = span.from - 1;
      const down = resolveAlong(doc, spans, above, 1);
      if (down !== span.from) {
        failures.push(
          `trial ${trial}: above ${above} down -> ${down}, want ${span.from}`,
        );
      }
      const below = tableWidgetRange(doc, span).to;
      const up = resolveAlong(doc, spans, below, -1);
      const wantUp = graphicEnterEnd(doc, span);
      if (up !== wantUp) {
        failures.push(
          `trial ${trial}: below ${below} up -> ${up}, want ${wantUp}`,
        );
      }
    }
    expect(failures.slice(0, 15)).toEqual([]);
  });

  it("enters the first graphic when several widgets are stacked with only blanks between", () => {
    const rand = mulberry32(0x57ac);
    const failures: string[] = [];
    for (let trial = 0; trial < 80; trial += 1) {
      // At least one blank line between widgets so "below first" ≠ second.from.
      const gap = "\n".repeat(2 + Math.floor(rand() * 3));
      const a = rand() < 0.5 ? "---" : "```\nx\n```";
      const b = rand() < 0.5 ? "---" : "```\ny\n```";
      const doc = `lead\n${a}${gap}${b}\nafter`;
      const spans = graphicSpansIn(doc);
      if (spans.length < 2) {
        failures.push(`trial ${trial}: expected 2 spans, got ${spans.length}`);
        continue;
      }
      const first = spans[0];
      const second = spans[1];
      const down = resolveAlong(doc, spans, first.from - 1, 1);
      if (down !== first.from) {
        failures.push(
          `trial ${trial}: down should hit first ${first.from}, got ${down}`,
        );
      }
      const between = tableWidgetRange(doc, first).to;
      if (between >= second.from) {
        failures.push(
          `trial ${trial}: gap too small between=${between} second=${second.from}`,
        );
        continue;
      }
      const down2 = resolveAlong(doc, spans, between, 1);
      if (down2 !== second.from) {
        failures.push(
          `trial ${trial}: between ${between} down -> ${down2}, want ${second.from} doc=${JSON.stringify(doc)}`,
        );
      }
      const up = resolveAlong(
        doc,
        spans,
        tableWidgetRange(doc, second).to,
        -1,
      );
      const wantUp = graphicEnterEnd(doc, second);
      if (up !== wantUp) {
        failures.push(
          `trial ${trial}: up into second got ${up}, want ${wantUp}`,
        );
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  });

  it("leaves the second adjacent widget when caret sits on its from", () => {
    const doc = "lead\n---\n---\nafter";
    const spans = graphicSpansIn(doc);
    expect(spans.length).toBe(2);
    const between = tableWidgetRange(doc, spans[0]).to;
    expect(between).toBe(spans[1].from);
    expect(caretRevealsTable(doc, spans[1], between)).toBe(true);
    // Single-line HR: down from its only line leaves onto "after".
    expect(resolveAlong(doc, spans, between, 1)).toBe(
      tableWidgetRange(doc, spans[1]).to,
    );
    expect(doc.slice(tableWidgetRange(doc, spans[1]).to)).toBe("after");
  });

  it("enters a graphic that starts the document", () => {
    const rand = mulberry32(0xd0c0);
    const failures: string[] = [];
    for (let trial = 0; trial < 60; trial += 1) {
      const leadBlanks = "\n".repeat(Math.floor(rand() * 3));
      const block =
        rand() < 0.5 ? "---" : randomTable(rand);
      const doc = `${leadBlanks}${block}\nafter`;
      const spans = graphicSpansIn(doc);
      if (spans.length === 0) {
        failures.push(`trial ${trial}: no span`);
        continue;
      }
      const span = spans[0];
      const below = tableWidgetRange(doc, span).to;
      const up = resolveAlong(doc, spans, below, -1);
      const wantUp = graphicEnterEnd(doc, span);
      if (up !== wantUp) {
        failures.push(
          `trial ${trial}: up from ${below} -> ${up}, want ${wantUp} in ${JSON.stringify(doc)}`,
        );
      }
      // ArrowRight from before doc start is N/A; from 0 if blank lead then across into block.
      if (span.from > 0) {
        const across = resolveAcross(doc, spans, span.from - 1, 1);
        if (across !== span.from) {
          failures.push(
            `trial ${trial}: across into leading graphic -> ${across}`,
          );
        }
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  });

  it("maps empty and single-character cell clicks to the cell content range", () => {
    const failures: string[] = [];
    const cases = [
      "| |\n|---|\n| |",
      "| a |\n|---|\n| b |",
      "| `x` |\n|---|\n| **y** |",
    ];
    for (const doc of cases) {
      const parsed = parseTable(doc, 0);
      if (!parsed) {
        failures.push(`parse failed: ${doc}`);
        continue;
      }
      const span = { from: parsed.from, to: parsed.to };
      for (const row of [parsed.header, ...parsed.rows]) {
        for (const cell of cellContentRanges(doc, row)) {
          const cellSource = doc.slice(cell.from, cell.to);
          for (let d = 0; d <= Math.max(1, cellSource.length); d += 1) {
            const pos = cell.from + displayOffsetToSource(cellSource, d);
            if (pos < cell.from || pos > cell.to) {
              failures.push(`out of cell: ${doc} d=${d} pos=${pos}`);
            }
            if (!caretRevealsTable(doc, span, pos)) {
              failures.push(`no reveal: ${doc} pos=${pos}`);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("walks the whole doc down and up without jumping over any graphic", () => {
    const rand = mulberry32(0xa1c0);
    const failures: string[] = [];
    for (let trial = 0; trial < 60; trial += 1) {
      const doc = randomDoc(rand);
      const spans = graphicSpansIn(doc);
      for (const direction of [1, -1] as const) {
        let caret = direction === 1 ? 0 : doc.length;
        const visited = new Set<number>();
        while (visited.size < doc.length + 8) {
          if (visited.has(caret)) {
            break;
          }
          visited.add(caret);
          const resolved = resolveAlong(doc, spans, caret, direction);
          if (resolved !== undefined) {
            for (const span of spans) {
              if (jumpsOver(doc, span, caret, resolved)) {
                failures.push(
                  `trial ${trial}: dir ${direction} ${caret}->${resolved} skips ${span.from}`,
                );
              }
            }
            caret = resolved + direction;
            continue;
          }
          const probe = cmSkipVertical(doc, spans, caret, direction);
          for (const span of spans) {
            if (jumpsOver(doc, span, caret, probe)) {
              failures.push(
                `trial ${trial}: dir ${direction} unhandled skip ${caret}->${probe} over ${span.from}`,
              );
            }
          }
          if (probe === caret) {
            break;
          }
          caret = probe;
        }
      }
    }
    expect(failures.slice(0, 15)).toEqual([]);
  });

  it("catches landing on a widget start or end as an enter", () => {
    const rand = mulberry32(0x1a7d);
    const failures: string[] = [];
    for (let trial = 0; trial < 80; trial += 1) {
      const doc = randomDoc(rand);
      const spans = graphicSpansIn(doc);
      for (const span of spans) {
        const range = tableWidgetRange(doc, span);
        if (range.from > 0) {
          const got = caretSkippedGraphic(
            doc,
            spans,
            range.from - 1,
            range.from,
          );
          if (got !== span.from) {
            failures.push(
              `trial ${trial}: land on from ${range.from} got ${got}`,
            );
          }
        }
        if (range.to < doc.length || range.to > 0) {
          const fromAfter = Math.min(doc.length, range.to + 1);
          if (fromAfter > range.to - 1) {
            const got = caretSkippedGraphic(
              doc,
              spans,
              fromAfter,
              range.to - 1,
            );
            if (
              got !== undefined &&
              !caretRevealsTable(doc, span, got) &&
              !spans.some((other) => caretRevealsTable(doc, other, got))
            ) {
              failures.push(
                `trial ${trial}: land inside from after got ${got}`,
              );
            }
          }
        }
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  });
});
