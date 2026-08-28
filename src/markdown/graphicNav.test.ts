import { describe, expect, it } from "vitest";
import {
  caretSkippedGraphic,
  enterGraphicAcross,
  enterGraphicAlong,
  leaveGraphicAlong,
  graphicSelection,
  tableClickPos,
} from "./graphicNav";
import { parseTable } from "./parseTable";

const source = "|a|\n|-|\n|b|\nnext";
const table = { from: 0, to: 11 };

describe("enterGraphicAlong", () => {
  it("enters the block from the line above on ArrowDown", () => {
    const withLead = `lead\n${source}`;
    const shifted = { from: 5, to: 16 };
    expect(enterGraphicAlong(withLead, [shifted], 4, 1)).toBe(5);
  });

  it("enters through blank lines that CM would skip with the widget", () => {
    const doc = "heading\n\n|a|\n|-|\n|b|\n";
    const span = { from: 9, to: 20 };
    expect(enterGraphicAlong(doc, [span], 7, 1)).toBe(9);
    expect(enterGraphicAlong(doc, [span], 8, 1)).toBe(9);
  });

  it("does not skip into a block when the next line has real content", () => {
    const doc = "heading\npara\n\n|a|\n|-|\n|b|\n";
    const span = { from: 14, to: 25 };
    expect(enterGraphicAlong(doc, [span], 0, 1)).toBeUndefined();
  });

  it("enters the block from the line below on ArrowUp", () => {
    expect(enterGraphicAlong(source, [table], 12, -1)).toBe(11);
  });

  it("enters upward through blank lines after a widget", () => {
    const doc = "|a|\n|-|\n|b|\n\n\nafter";
    const span = { from: 0, to: 11 };
    expect(enterGraphicAlong(doc, [span], 14, -1)).toBe(11);
  });

  it("enters upward when the document starts with a blank line before a widget", () => {
    const doc = "\n---\nafter";
    const span = { from: 1, to: 4 };
    expect(enterGraphicAlong(doc, [span], 5, -1)).toBe(4);
  });

  it("enters a following fence from the blank line after a prior fence", () => {
    const doc = "```\nx\n```\n\n```\ny\n```\n";
    const spans = [
      { from: 0, to: 10 },
      { from: 11, to: 21 },
    ];
    expect(enterGraphicAlong(doc, spans, 10, 1)).toBe(11);
  });

  it("does not steal ArrowDown from mid-line wraps on a long paragraph", () => {
    const doc = "word ".repeat(40) + "\n\n---\n";
    const hr = { from: doc.indexOf("---"), to: doc.indexOf("---") + 3 };
    expect(enterGraphicAlong(doc, [hr], 10, 1)).toBeUndefined();
    expect(enterGraphicAlong(doc, [hr], doc.indexOf("\n"), 1)).toBe(hr.from);
  });
});

describe("leaveGraphicAlong", () => {
  it("exits a revealed thematic break downward onto the next line", () => {
    const doc = "before\n---\nafter";
    const hr = { from: 7, to: 10 };
    expect(leaveGraphicAlong(doc, [hr], 8, 1)).toBe(11);
    expect(enterGraphicAlong(doc, [hr], 8, 1)).toBe(11);
  });

  it("exits a revealed thematic break upward onto the previous line", () => {
    const doc = "before\n---\nafter";
    const hr = { from: 7, to: 10 };
    expect(leaveGraphicAlong(doc, [hr], 9, -1)).toBe(6);
  });

  it("exits a revealed table onto the start of the following line", () => {
    const doc = "|a|\n|-|\n|b|\nnext";
    const table = { from: 0, to: 11 };
    // From the last row only — not from the header.
    expect(leaveGraphicAlong(doc, [table], 2, 1)).toBeUndefined();
    expect(leaveGraphicAlong(doc, [table], 9, 1)).toBe(12);
    expect(doc.slice(12)).toBe("next");
  });

  it("exits a table whose span already includes the trailing newline", () => {
    const doc = "|a|\n|-|\n|b|\nnext";
    const table = { from: 0, to: 12 };
    expect(leaveGraphicAlong(doc, [table], 9, 1)).toBe(12);
  });

  it("does not exit a multi-line table from an interior row", () => {
    const doc = "|a|\n|-|\n|b|\n|c|\nnext";
    const table = { from: 0, to: 15 };
    expect(leaveGraphicAlong(doc, [table], 9, 1)).toBeUndefined();
    expect(leaveGraphicAlong(doc, [table], 13, 1)).toBe(16);
  });

  it("skips blank lines after a table so the caret is not drawn beside the widget", () => {
    const doc = "|a|\n|-|\n|b|\n\nafter";
    const table = { from: 0, to: 11 };
    // range.to is the blank line; landing there paints beside the collapsed widget.
    expect(leaveGraphicAlong(doc, [table], 9, 1)).toBe(13);
    expect(doc.slice(13)).toBe("after");
  });
});

describe("enterGraphicAcross", () => {
  it("enters from the character before the widget on ArrowRight", () => {
    const withLead = `x${source}`;
    const shifted = { from: 1, to: 12 };
    expect(enterGraphicAcross(withLead, [shifted], 0, 1)).toBe(1);
  });

  it("enters from the position after the widget on ArrowLeft", () => {
    expect(enterGraphicAcross(source, [table], 12, -1)).toBe(11);
  });

  it("does not intercept when the caret is already inside", () => {
    expect(enterGraphicAcross(source, [table], 1, 1)).toBeUndefined();
  });
});

describe("tableClickPos", () => {
  it("maps a clicked header or body cell to its content offset", () => {
    const doc = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const parsed = parseTable(doc, 0)!;
    expect(tableClickPos(doc, parsed, 0, 0)).toBe(2);
    expect(tableClickPos(doc, parsed, 0, 1)).toBe(6);
    expect(tableClickPos(doc, parsed, 1, 0)).toBe(26);
    expect(tableClickPos(doc, parsed, 1, 1)).toBe(30);
  });
});

describe("graphicSelection", () => {
  it("places a caret on plain click and extends on shift-click", () => {
    expect(graphicSelection(10, false, 3)).toEqual({ anchor: 10 });
    expect(graphicSelection(10, true, 3)).toEqual({ anchor: 3, head: 10 });
  });
});

describe("caretSkippedGraphic", () => {
  it("detects a vertical move that skipped an entire graphic block", () => {
    const doc = "heading\n\n|a|\n|-|\n|b|\nafter";
    const span = { from: 9, to: 20 };
    expect(caretSkippedGraphic(doc, [span], 0, 21)).toBe(9);
    expect(caretSkippedGraphic(doc, [span], 21, 0)).toBe(20);
    expect(caretSkippedGraphic(doc, [span], 0, 5)).toBeUndefined();
  });

  it("enters the nearest block when a jump crosses several widgets", () => {
    const doc = "a\n---\nb\n---\nc";
    const first = { from: 2, to: 5 };
    const second = { from: 8, to: 11 };
    expect(caretSkippedGraphic(doc, [first, second], 0, 12)).toBe(2);
    expect(caretSkippedGraphic(doc, [first, second], 12, 0)).toBe(11);
  });
});
