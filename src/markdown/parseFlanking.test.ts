import { describe, expect, it } from "vitest";
import { parseInlineMarkdown, type InlineSpan } from "./parse";

function kinds(source: string): string[] {
  return parseInlineMarkdown(source, 0, source.length).map(
    (span: InlineSpan) => `${span.kind}:${source.slice(span.from, span.to)}`,
  );
}

describe("emphasis flanking", () => {
  it("does not treat a leading bullet star as an emphasis opener", () => {
    expect(kinds("* item with *emph*")).toEqual([
      "text:* item with ",
      "em:*emph*",
    ]);
  });

  it("leaves arithmetic stars surrounded by spaces as text", () => {
    expect(kinds("2 * 3 * 4")).toEqual(["text:2 * 3 * 4"]);
  });

  it("skips a closing star preceded by whitespace", () => {
    expect(kinds("*a * b*")).toEqual(["em:*a * b*"]);
    expect(kinds("*emph *")).toEqual(["text:*emph *"]);
  });

  it("applies the same rule to strong runs", () => {
    expect(kinds("a ** b ** c")).toEqual(["text:a ** b ** c"]);
    expect(kinds("**bold**")).toEqual(["strong:**bold**"]);
  });
});
