import { describe, expect, it } from "vitest";
import { DEFAULT_MARKDOWN_FEATURES } from "./features";
import { parseTable } from "./parseTable";
import { richTableGrid } from "./tableCells";

describe("richTableGrid", () => {
  it("keeps plain cells as text nodes", () => {
    const source = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const table = parseTable(source, 0)!;
    expect(richTableGrid(source, table)).toEqual({
      header: [[{ kind: "text", text: "a" }], [{ kind: "text", text: "b" }]],
      rows: [
        [[{ kind: "text", text: "1" }], [{ kind: "text", text: "2" }]],
      ],
    });
  });

  it("parses inline code and strong inside cells", () => {
    const source =
      "| Feld | Relevanz |\n| --- | --- |\n| `id` | **Delta** |";
    const table = parseTable(source, 0)!;
    expect(richTableGrid(source, table, DEFAULT_MARKDOWN_FEATURES)).toEqual({
      header: [
        [{ kind: "text", text: "Feld" }],
        [{ kind: "text", text: "Relevanz" }],
      ],
      rows: [
        [
          [{ kind: "code", children: [{ kind: "text", text: "id" }] }],
          [
            {
              kind: "strong",
              children: [{ kind: "text", text: "Delta" }],
            },
          ],
        ],
      ],
    });
  });

  it("nests inline code inside strong in a cell", () => {
    const source = "|x|\n|-|\n|**`idoit.info`**|";
    const table = parseTable(source, 0)!;
    expect(richTableGrid(source, table).rows[0][0]).toEqual([
      {
        kind: "strong",
        children: [
          { kind: "code", children: [{ kind: "text", text: "idoit.info" }] },
        ],
      },
    ]);
  });
});
