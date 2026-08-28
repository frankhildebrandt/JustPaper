import { describe, expect, it } from "vitest";
import { codeCard } from "./codeCard";

describe("codeCard", () => {
  it("numbers each line and drops a trailing newline", () => {
    expect(codeCard("", "first\nsecond\n")).toEqual({
      language: "",
      lines: [
        { number: 1, spans: [{ kind: "text", text: "first" }] },
        { number: 2, spans: [{ kind: "text", text: "second" }] },
      ],
    });
  });

  it("keeps a single empty line for an empty body", () => {
    expect(codeCard("ts", "")).toEqual({
      language: "ts",
      lines: [{ number: 1, spans: [] }],
    });
  });

  it("highlights Go keywords, strings, and comments", () => {
    expect(codeCard("go", 'func main() {\n  // hi\n  x := "go"\n}')).toEqual({
      language: "go",
      lines: [
        {
          number: 1,
          spans: [
            { kind: "keyword", text: "func" },
            { kind: "text", text: " " },
            { kind: "ident", text: "main" },
            { kind: "text", text: "() {" },
          ],
        },
        {
          number: 2,
          spans: [
            { kind: "text", text: "  " },
            { kind: "comment", text: "// hi" },
          ],
        },
        {
          number: 3,
          spans: [
            { kind: "text", text: "  " },
            { kind: "ident", text: "x" },
            { kind: "text", text: " := " },
            { kind: "string", text: '"go"' },
          ],
        },
        {
          number: 4,
          spans: [{ kind: "text", text: "}" }],
        },
      ],
    });
  });
});
