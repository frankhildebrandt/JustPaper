import { describe, expect, it } from "vitest";
import {
  decorationRevealKey,
  decorationSpecs,
  atomicSyntaxRanges,
  headingPrefixRanges,
  todoBoxRanges,
} from "./decorationSpecs";
import { parseMarkdown } from "./parse";

describe("decorationSpecs", () => {
  it("styles a heading line and shows hanging ATX marks while editing", () => {
    expect(
      decorationSpecs(parseMarkdown("# Title"), { showMarks: true }),
    ).toEqual([
      { kind: "line-h1", from: 0, to: 7 },
      { kind: "atx", from: 0, to: 2 },
    ]);
  });

  it("hides ATX hashes and their required space in view", () => {
    expect(
      decorationSpecs(parseMarkdown("# Title"), { showMarks: false }),
    ).toEqual([
      { kind: "line-h1", from: 0, to: 7 },
      { kind: "hide", from: 0, to: 2 },
    ]);
  });

  it("styles strong text and keeps marker ranges visible while editing", () => {
    expect(
      decorationSpecs(parseMarkdown("say **hi**"), { showMarks: true }),
    ).toEqual([
      { kind: "mark", from: 4, to: 6 },
      { kind: "strong", from: 6, to: 8 },
      { kind: "mark", from: 8, to: 10 },
    ]);
  });

  it("hides strong markers in view and keeps the inner style", () => {
    expect(
      decorationSpecs(parseMarkdown("say **hi**"), { showMarks: false }),
    ).toEqual([
      { kind: "hide", from: 4, to: 6 },
      { kind: "strong", from: 6, to: 8 },
      { kind: "hide", from: 8, to: 10 },
    ]);
  });

  it("applies strong and code when inline code is nested in bold", () => {
    expect(
      decorationSpecs(parseMarkdown("**`idoit.info`**"), {
        showMarks: false,
      }),
    ).toEqual([
      { kind: "hide", from: 0, to: 2 },
      { kind: "strong", from: 2, to: 14 },
      { kind: "hide", from: 2, to: 3 },
      { kind: "code", from: 3, to: 13 },
      { kind: "hide", from: 13, to: 14 },
      { kind: "hide", from: 14, to: 16 },
    ]);
  });

  it("styles emphasis and code the same way as strong", () => {
    const em = decorationSpecs(parseMarkdown("*x*"), { showMarks: true });
    const code = decorationSpecs(parseMarkdown("`x`"), { showMarks: true });

    expect(em).toEqual([
      { kind: "mark", from: 0, to: 1 },
      { kind: "em", from: 1, to: 2 },
      { kind: "mark", from: 2, to: 3 },
    ]);
    expect(code).toEqual([
      { kind: "mark", from: 0, to: 1 },
      { kind: "code", from: 1, to: 2 },
      { kind: "mark", from: 2, to: 3 },
    ]);
  });

  it("styles a wiki link and hides its marks in view", () => {
    expect(
      decorationSpecs(parseMarkdown("[[Note]]"), { showMarks: true }),
    ).toEqual([
      { kind: "mark", from: 0, to: 2 },
      { kind: "wiki", from: 2, to: 6 },
      { kind: "mark", from: 6, to: 8 },
    ]);
    expect(
      decorationSpecs(parseMarkdown("[[Note|shown]]"), { showMarks: false }),
    ).toEqual([
      { kind: "hide", from: 0, to: 2 },
      { kind: "hide", from: 2, to: 7 },
      { kind: "wiki", from: 7, to: 12 },
      { kind: "hide", from: 12, to: 14 },
    ]);
  });

  it("mutes frontmatter while editing and hides it in view", () => {
    const source = "---\ntitle: Hi\n---\n";
    expect(
      decorationSpecs(parseMarkdown(source), { showMarks: true }),
    ).toEqual([{ kind: "frontmatter", from: 0, to: 18 }]);
    expect(
      decorationSpecs(parseMarkdown(source), { showMarks: false }),
    ).toEqual([{ kind: "hide", from: 0, to: 18 }]);
  });

  it("styles quote prefixes and hides them in view", () => {
    expect(
      decorationSpecs(parseMarkdown("> hi"), { showMarks: true }),
    ).toEqual([
      { kind: "line-blockquote", from: 0, to: 4 },
      { kind: "mark", from: 0, to: 2 },
    ]);
    expect(
      decorationSpecs(parseMarkdown("> hi"), { showMarks: false }),
    ).toEqual([
      { kind: "line-blockquote", from: 0, to: 4 },
      { kind: "hide", from: 0, to: 2 },
    ]);
  });

  it("styles a fenced code body and hides fences in view", () => {
    const source = "```\nhi\n```";
    expect(
      decorationSpecs(parseMarkdown(source), { showMarks: false }),
    ).toEqual([
      { kind: "hide", from: 0, to: 4 },
      { kind: "codeblock", from: 4, to: 7 },
      { kind: "hide", from: 7, to: 10 },
    ]);
  });

  it("styles table pipes and header cells, and hides the delimiter in view", () => {
    const source = "|a|\n|-|\n|b|";
    expect(
      decorationSpecs(parseMarkdown(source), { showMarks: true }),
    ).toEqual([
      { kind: "table-pipe", from: 0, to: 1 },
      { kind: "table-pipe", from: 2, to: 3 },
      { kind: "table-pipe", from: 4, to: 5 },
      { kind: "table-pipe", from: 6, to: 7 },
      { kind: "table-pipe", from: 8, to: 9 },
      { kind: "table-pipe", from: 10, to: 11 },
      { kind: "table-header", from: 1, to: 2 },
    ]);
    expect(
      decorationSpecs(parseMarkdown(source), { showMarks: false }),
    ).toEqual([
      { kind: "table-pipe", from: 0, to: 1 },
      { kind: "table-pipe", from: 2, to: 3 },
      { kind: "table-pipe", from: 8, to: 9 },
      { kind: "table-pipe", from: 10, to: 11 },
      { kind: "table-header", from: 1, to: 2 },
      { kind: "hide", from: 4, to: 8 },
    ]);
  });

  it("styles an external link like a wiki link", () => {
    expect(
      decorationSpecs(parseMarkdown("[docs](https://example.com)"), {
        showMarks: false,
      }),
    ).toEqual([
      { kind: "hide", from: 0, to: 1 },
      { kind: "link", from: 1, to: 5 },
      { kind: "hide", from: 5, to: 27 },
    ]);
  });

  it("replaces an image with a widget in view", () => {
    expect(
      decorationSpecs(parseMarkdown("![logo](pic.png)"), { showMarks: false }),
    ).toEqual([
      {
        kind: "image-widget",
        from: 0,
        to: 16,
        href: "pic.png",
        alt: "logo",
      },
    ]);
  });

  it("replaces a task box with a widget and strikes done text", () => {
    expect(
      decorationSpecs(parseMarkdown("- [ ] milk"), { showMarks: true }),
    ).toEqual([
      { kind: "line-todo", from: 0, to: 10 },
      { kind: "mark", from: 0, to: 2 },
      { kind: "todo-widget", from: 2, to: 5, checked: false },
    ]);
    expect(
      decorationSpecs(parseMarkdown("- [x] milk"), { showMarks: false }),
    ).toEqual([
      { kind: "line-todo", from: 0, to: 10 },
      { kind: "hide", from: 0, to: 2 },
      { kind: "todo-widget", from: 2, to: 5, checked: true },
      { kind: "todo-done", from: 6, to: 10 },
    ]);
  });

  it("replaces a table with a widget in graphic view", () => {
    const source = "| a | b |\n| --- | --- |\n| 1 | 2 |\n";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: false,
        graphic: true,
        source,
      }),
    ).toEqual([
      {
        kind: "table-widget",
        from: 0,
        to: source.length,
        header: [
          [{ kind: "text", text: "a" }],
          [{ kind: "text", text: "b" }],
        ],
        rows: [
          [
            [{ kind: "text", text: "1" }],
            [{ kind: "text", text: "2" }],
          ],
        ],
        cellPositions: [
          [
            { from: 2, to: 3 },
            { from: 6, to: 7 },
          ],
          [
            { from: 26, to: 27 },
            { from: 30, to: 31 },
          ],
        ],
      },
    ]);
  });

  it("replaces a table with a widget in graphic edit when the caret is outside", () => {
    const source = "| a | b |\n| --- | --- |\n| 1 | 2 |\n";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: true,
        graphic: true,
        source,
        caret: source.length,
      }),
    ).toEqual([
      {
        kind: "table-widget",
        from: 0,
        to: source.length,
        header: [
          [{ kind: "text", text: "a" }],
          [{ kind: "text", text: "b" }],
        ],
        rows: [
          [
            [{ kind: "text", text: "1" }],
            [{ kind: "text", text: "2" }],
          ],
        ],
        cellPositions: [
          [
            { from: 2, to: 3 },
            { from: 6, to: 7 },
          ],
          [
            { from: 26, to: 27 },
            { from: 30, to: 31 },
          ],
        ],
        opensSource: true,
      },
    ]);
  });

  it("renders inline markdown inside graphic table cells", () => {
    const source = "| Feld |\n| --- |\n| `id` |\n| **Delta** |\n";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: false,
        graphic: true,
        source,
      }),
    ).toEqual([
      {
        kind: "table-widget",
        from: 0,
        to: source.length,
        header: [[{ kind: "text", text: "Feld" }]],
        rows: [
          [[{ kind: "code", children: [{ kind: "text", text: "id" }] }]],
          [
            [
              {
                kind: "strong",
                children: [{ kind: "text", text: "Delta" }],
              },
            ],
          ],
        ],
        cellPositions: [
          [{ from: 2, to: 6 }],
          [{ from: 19, to: 23 }],
          [{ from: 28, to: 37 }],
        ],
      },
    ]);
  });

  it("styles inline markdown in table cells when showing source", () => {
    const source = "|x|\n|-|\n|`id`|";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: false,
        source,
      }),
    ).toEqual([
      { kind: "table-pipe", from: 0, to: 1 },
      { kind: "table-pipe", from: 2, to: 3 },
      { kind: "table-pipe", from: 8, to: 9 },
      { kind: "table-pipe", from: 13, to: 14 },
      { kind: "table-header", from: 1, to: 2 },
      { kind: "hide", from: 9, to: 10 },
      { kind: "code", from: 10, to: 12 },
      { kind: "hide", from: 12, to: 13 },
      { kind: "hide", from: 4, to: 8 },
    ]);
  });

  it("keeps source table marks in graphic edit when the caret is inside", () => {
    const source = "|a|\n|-|\n|b|";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: true,
        graphic: true,
        source,
        caret: 1,
      }),
    ).toEqual(
      decorationSpecs(parseMarkdown(source), { showMarks: true }),
    );
  });

  it("replaces a fenced code block with a widget in graphic edit when the caret is outside", () => {
    const source = "lead\n```go\nfunc main() {}\n```\n";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: true,
        graphic: true,
        source,
        caret: 0,
      }),
    ).toEqual([
      {
        kind: "code-widget",
        from: 5,
        to: source.length,
        language: "go",
        body: "func main() {}\n",
        bodyFrom: 11,
        opensSource: true,
      },
    ]);
  });

  it("replaces a fenced code block with a widget in graphic view", () => {
    const source = "```ts\nconst x = 1\n```\n";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: false,
        graphic: true,
        source,
      }),
    ).toEqual([
      {
        kind: "code-widget",
        from: 0,
        to: source.length,
        language: "ts",
        body: "const x = 1\n",
        bodyFrom: 6,
      },
    ]);
  });

  it("hides edit marks when the caret is outside the construct", () => {
    expect(
      decorationSpecs(parseMarkdown("say **hi**"), {
        showMarks: true,
        caret: 0,
      }),
    ).toEqual([
      { kind: "hide", from: 4, to: 6 },
      { kind: "strong", from: 6, to: 8 },
      { kind: "hide", from: 8, to: 10 },
    ]);
    expect(
      decorationSpecs(parseMarkdown("plain\n# Title"), {
        showMarks: true,
        caret: 0,
      }),
    ).toEqual([
      { kind: "line-h1", from: 6, to: 13 },
      { kind: "hide", from: 6, to: 8 },
    ]);
    expect(
      decorationSpecs(parseMarkdown("x [[Note]]"), {
        showMarks: true,
        caret: 0,
      }),
    ).toEqual([
      { kind: "hide", from: 2, to: 4 },
      { kind: "wiki", from: 4, to: 8 },
      { kind: "hide", from: 8, to: 10 },
    ]);
    expect(
      decorationSpecs(parseMarkdown("x\n> hi"), {
        showMarks: true,
        caret: 0,
      }),
    ).toEqual([
      { kind: "line-blockquote", from: 2, to: 6 },
      { kind: "hide", from: 2, to: 4 },
    ]);
    const fence = "x\n```\nhi\n```";
    expect(
      decorationSpecs(parseMarkdown(fence), {
        showMarks: true,
        caret: 0,
      }),
    ).toEqual([
      { kind: "hide", from: 2, to: 6 },
      { kind: "codeblock", from: 6, to: 9 },
      { kind: "hide", from: 9, to: 12 },
    ]);
    expect(
      decorationSpecs(parseMarkdown("x\n- [ ] milk"), {
        showMarks: true,
        caret: 0,
      }),
    ).toEqual([
      { kind: "line-todo", from: 2, to: 12 },
      { kind: "hide", from: 2, to: 4 },
      { kind: "todo-widget", from: 4, to: 7, checked: false },
    ]);
    expect(
      decorationSpecs(parseMarkdown("x ![logo](pic.png)"), {
        showMarks: true,
        caret: 0,
      }),
    ).toEqual([
      {
        kind: "image-widget",
        from: 2,
        to: 18,
        href: "pic.png",
        alt: "logo",
      },
    ]);
  });

  it("replaces a thematic break with an hr widget when marks are hidden", () => {
    const source = "before\n---\nafter";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: false,
        source,
      }),
    ).toEqual([{ kind: "hr-widget", from: 7, to: 11 }]);
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: true,
        caret: 0,
        source,
      }),
    ).toEqual([
      {
        kind: "hr-widget",
        from: 7,
        to: 11,
        opensSource: true,
      },
    ]);
  });

  it("shows the thematic break source when the caret is on that line", () => {
    const source = "before\n---\nafter";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: true,
        caret: 8,
        source,
      }),
    ).toEqual([{ kind: "mark", from: 7, to: 10 }]);
  });

  it("replaces a blockquote with a widget in graphic view", () => {
    const source = "> one\n> two\n";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: false,
        graphic: true,
        source,
      }),
    ).toEqual([
      {
        kind: "quote-widget",
        from: 0,
        to: source.length,
        lines: ["one", "two"],
      },
    ]);
  });

  it("replaces an Obsidian callout with a colored widget in graphic view", () => {
    const source = "> [!info] Quelle\n> Repo-SSOT: `docs/adr.md`\n";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: false,
        graphic: true,
        source,
      }),
    ).toEqual([
      {
        kind: "quote-widget",
        from: 0,
        to: source.length,
        lines: ["Repo-SSOT: `docs/adr.md`"],
        calloutType: "info",
        calloutTitle: "Quelle",
        bodyNodes: [
          [
            { kind: "text", text: "Repo-SSOT: " },
            { kind: "code", children: [{ kind: "text", text: "docs/adr.md" }] },
          ],
        ],
      },
    ]);
  });

  it("colors callout lines and hides the type marker in view", () => {
    const source = "> [!info] Quelle\n> body";
    expect(
      decorationSpecs(parseMarkdown(source), {
        showMarks: false,
        source,
      }),
    ).toEqual([
      { kind: "line-blockquote", from: 0, to: 16, calloutType: "info" },
      { kind: "hide", from: 0, to: 2 },
      { kind: "line-blockquote", from: 17, to: 23, calloutType: "info" },
      { kind: "hide", from: 17, to: 19 },
      { kind: "hide", from: 2, to: 9 },
      { kind: "callout-title", from: 10, to: 16 },
    ]);
  });
});

describe("headingPrefixRanges", () => {
  it("covers hashes and the hidden space so the caret cannot sit in the gap", () => {
    expect(headingPrefixRanges(parseMarkdown("# Title"))).toEqual([
      { from: 0, to: 2 },
    ]);
    expect(headingPrefixRanges(parseMarkdown("## Title"))).toEqual([
      { from: 0, to: 3 },
    ]);
  });

  it("covers the task box so the caret skips the checkbox", () => {
    expect(todoBoxRanges(parseMarkdown("- [ ] milk"))).toEqual([
      { from: 2, to: 5 },
    ]);
  });
});

describe("decorationRevealKey", () => {
  it("stays stable while the caret moves inside the same revealed construct", () => {
    const source = "say **hi** there";
    const blocks = parseMarkdown(source);
    const insideOpen = decorationRevealKey(blocks, {
      showMarks: true,
      caret: 6,
      source,
    });
    const insideStill = decorationRevealKey(blocks, {
      showMarks: true,
      caret: 7,
      source,
    });
    const outside = decorationRevealKey(blocks, {
      showMarks: true,
      caret: 0,
      source,
    });
    expect(insideOpen).toBe(insideStill);
    expect(insideOpen).not.toBe(outside);
  });

  it("changes when a graphic table expands under the caret", () => {
    const source = "lead\n|a|\n|-|\n|b|\n";
    const blocks = parseMarkdown(source);
    const collapsed = decorationRevealKey(blocks, {
      showMarks: true,
      graphic: true,
      source,
      caret: 0,
    });
    const expanded = decorationRevealKey(blocks, {
      showMarks: true,
      graphic: true,
      source,
      caret: 6,
    });
    expect(collapsed).not.toBe(expanded);
  });
});

describe("atomicSyntaxRanges", () => {
  it("includes hidden inline marks so the caret skips them", () => {
    const source = "say **hi**";
    const blocks = parseMarkdown(source);
    expect(
      atomicSyntaxRanges(blocks, {
        showMarks: true,
        caret: 0,
        source,
      }),
    ).toEqual(
      expect.arrayContaining([
        { from: 4, to: 6 },
        { from: 8, to: 10 },
      ]),
    );
  });
});
