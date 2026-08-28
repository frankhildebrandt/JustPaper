import { highlightGo, type HighlightSpan } from "./highlightGo";

export type CodeLine = {
  number: number;
  spans: HighlightSpan[];
};

export type CodeCard = {
  language: string;
  lines: CodeLine[];
};

/**
 * Turns a fenced code body into numbered lines, with Go highlighting for `go`.
 */
export function codeCard(language: string, body: string): CodeCard {
  const source = body.endsWith("\n") ? body.slice(0, -1) : body;
  const spans =
    language === "go" ? highlightGo(source) : [{ kind: "text" as const, text: source }];
  return {
    language,
    lines: numberLines(spans),
  };
}

function numberLines(spans: HighlightSpan[]): CodeLine[] {
  const lines: HighlightSpan[][] = [[]];
  for (const span of spans) {
    const parts = span.text.split("\n");
    for (let index = 0; index < parts.length; index += 1) {
      if (index > 0) {
        lines.push([]);
      }
      if (parts[index].length > 0) {
        lines[lines.length - 1].push({ kind: span.kind, text: parts[index] });
      }
    }
  }
  return lines.map((lineSpans, index) => ({
    number: index + 1,
    spans: lineSpans,
  }));
}
