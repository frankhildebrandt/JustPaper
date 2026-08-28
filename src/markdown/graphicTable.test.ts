import { describe, expect, it } from "vitest";
import {
  caretRevealsTable,
  enterGraphicTable,
  tableWidgetRange,
} from "./graphicTable";

const source = "|a|\n|-|\n|b|\nnext";
const table = { from: 0, to: 11 };

describe("tableWidgetRange", () => {
  it("includes the trailing newline after the last row", () => {
    expect(tableWidgetRange(source, table)).toEqual({ from: 0, to: 12 });
  });

  it("does not swallow a blank line after a fence that already ends with newline", () => {
    const doc = "```\nx\n```\n\nnext";
    const fence = { from: 0, to: 10 }; // `to` includes the newline after closing ```
    expect(doc.slice(0, 10)).toBe("```\nx\n```\n");
    expect(tableWidgetRange(doc, fence)).toEqual({ from: 0, to: 10 });
  });
});

describe("caretRevealsTable", () => {
  it("is true only while the caret sits inside the table", () => {
    expect(caretRevealsTable(source, table, 1)).toBe(true);
    expect(caretRevealsTable(source, table, 11)).toBe(true);
    expect(caretRevealsTable(source, table, 12)).toBe(false);
    expect(caretRevealsTable(source, table, undefined)).toBe(false);
  });

  it("keeps the source open when the caret is at the end of a file-only table", () => {
    const only = "|a|\n|-|\n|b|";
    expect(caretRevealsTable(only, { from: 0, to: 11 }, 11)).toBe(true);
  });

  it("does not keep a fence open at the position after its trailing newline", () => {
    const doc = "```\nx\n```\n\nnext";
    const fence = { from: 0, to: 10 };
    expect(caretRevealsTable(doc, fence, 9)).toBe(true);
    expect(caretRevealsTable(doc, fence, 10)).toBe(false);
  });
});

describe("enterGraphicTable", () => {
  it("enters the table from the line above on ArrowDown", () => {
    const withLead = `lead\n${source}`;
    const shifted = { from: 5, to: 16 };
    expect(enterGraphicTable(withLead, [shifted], 4, 1)).toBe(5);
  });

  it("enters the table from the line below on ArrowUp", () => {
    expect(enterGraphicTable(source, [table], 12, -1)).toBe(11);
  });

  it("leaves the table downward from the last row onto the next line", () => {
    expect(enterGraphicTable(source, [table], 1, 1)).toBeUndefined();
    expect(enterGraphicTable(source, [table], 9, 1)).toBe(12);
    expect(source.slice(12)).toBe("next");
  });
});
