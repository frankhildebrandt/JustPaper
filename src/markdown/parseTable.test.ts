import { describe, expect, it } from "vitest";
import { parseTable, tableGrid } from "./parseTable";

describe("parseTable", () => {
  it("parses a GFM table with a header, delimiter, and body row", () => {
    const source = "|a|\n|-|\n|b|";
    expect(parseTable(source, 0)).toEqual({
      from: 0,
      to: 11,
      next: 11,
      header: { from: 0, to: 3 },
      delimiter: { from: 4, to: 7 },
      rows: [{ from: 8, to: 11 }],
      pipes: [
        { from: 0, to: 1 },
        { from: 2, to: 3 },
        { from: 4, to: 5 },
        { from: 6, to: 7 },
        { from: 8, to: 9 },
        { from: 10, to: 11 },
      ],
      headerCells: [{ from: 1, to: 2 }],
    });
  });

  it("rejects a pipe row without a delimiter line", () => {
    expect(parseTable("|a|\nplain", 0)).toBeUndefined();
  });

  it("returns undefined when the line has no pipe", () => {
    expect(parseTable("plain", 0)).toBeUndefined();
  });
});

describe("tableGrid", () => {
  it("returns trimmed header and body cells for a GFM table", () => {
    const source = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const table = parseTable(source, 0);
    expect(table).toBeDefined();
    expect(tableGrid(source, table!)).toEqual({
      header: ["a", "b"],
      rows: [["1", "2"]],
    });
  });

  it("does not treat a wiki-link alias pipe as a cell separator", () => {
    const source =
      "| Vendor |\n| --- |\n| [[Hersteller/Arista Networks|Arista Networks]] |";
    const table = parseTable(source, 0);
    expect(table).toBeDefined();
    expect(tableGrid(source, table!)).toEqual({
      header: ["Vendor"],
      rows: [["[[Hersteller/Arista Networks|Arista Networks]]"]],
    });
    // Alias `|` must not appear in the structural pipe list.
    const aliasPipe = source.indexOf("|Arista");
    expect(
      table!.pipes.some((pipe) => pipe.from === aliasPipe),
    ).toBe(false);
  });
});
