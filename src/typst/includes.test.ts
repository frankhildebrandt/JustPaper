import { describe, expect, it } from "vitest";
import {
  appendTypstInclude,
  collectTypstProjectFiles,
  incomingTypstIncludes,
  outgoingTypstIncludes,
  relativeTypstIncludePath,
  resolveTypstInclude,
  typstIncludeAt,
  typstIncludesIn,
} from "./includes";

describe("typstIncludesIn", () => {
  it("reads quoted include paths in source order", () => {
    const source = [
      '#include "layout.typ"',
      '#include "kapitel/00-titel.typ"',
      '#include "kapitel/01-kontext.typ"',
    ].join("\n");
    expect(typstIncludesIn(source).map((include) => include.path)).toEqual([
      "layout.typ",
      "kapitel/00-titel.typ",
      "kapitel/01-kontext.typ",
    ]);
  });

  it("reads the parenthesized include form", () => {
    expect(typstIncludesIn('#include("layout.typ")').map((include) => include.path)).toEqual([
      "layout.typ",
    ]);
  });

  it("ignores includes in comments and raw fences", () => {
    const source = [
      '// #include "skipped.typ"',
      "```",
      '#include "fenced.typ"',
      "```",
      '#include "kept.typ"',
    ].join("\n");
    expect(typstIncludesIn(source).map((include) => include.path)).toEqual([
      "kept.typ",
    ]);
  });
});

describe("typstIncludeAt", () => {
  it("finds the include that contains the caret", () => {
    expect(typstIncludeAt('#include "layout.typ"', 3)?.path).toBe("layout.typ");
  });

  it("returns undefined when the caret is outside any include", () => {
    expect(typstIncludeAt("= Title\n#include \"layout.typ\"", 0)).toBeUndefined();
  });
});

describe("resolveTypstInclude", () => {
  it("resolves a sibling path from the including file", () => {
    expect(resolveTypstInclude("main.typ", "layout.typ")).toBe("layout.typ");
  });

  it("resolves a nested include relative to the including file", () => {
    expect(resolveTypstInclude("kapitel/a.typ", "shared.typ")).toBe(
      "kapitel/shared.typ",
    );
  });

  it("normalizes parent segments that stay inside the project", () => {
    expect(resolveTypstInclude("kapitel/a.typ", "../layout.typ")).toBe(
      "layout.typ",
    );
  });

  it("rejects paths that leave the project root", () => {
    expect(resolveTypstInclude("main.typ", "../secret.typ")).toBeUndefined();
    expect(resolveTypstInclude("kapitel/a.typ", "../../x.typ")).toBeUndefined();
  });
});

describe("collectTypstProjectFiles", () => {
  const files = new Map<string, string>([
    [
      "main.typ",
      '#include "layout.typ"\n#include "kapitel/00.typ"\n#include "kapitel/01.typ"\n',
    ],
    ["layout.typ", '#include "fonts.typ"\n'],
    ["fonts.typ", "= Fonts\n"],
    ["kapitel/00.typ", '#include "shared.typ"\n'],
    ["kapitel/shared.typ", "= Shared\n"],
    ["kapitel/01.typ", "= Chapter\n"],
  ]);
  const read = async (path: string): Promise<string | undefined> =>
    files.get(path);

  it("lists the main file then includes depth-first in source order", async () => {
    expect(await collectTypstProjectFiles("main.typ", read)).toEqual([
      "main.typ",
      "layout.typ",
      "fonts.typ",
      "kapitel/00.typ",
      "kapitel/shared.typ",
      "kapitel/01.typ",
    ]);
  });

  it("lists missing includes without following them", async () => {
    expect(
      await collectTypstProjectFiles("main.typ", async (path) => {
        if (path === "main.typ") {
          return '#include "gone.typ"\n';
        }
        return undefined;
      }),
    ).toEqual(["main.typ", "gone.typ"]);
  });

  it("skips cycles", async () => {
    expect(
      await collectTypstProjectFiles("a.typ", async (path) => {
        if (path === "a.typ") {
          return '#include "b.typ"\n';
        }
        if (path === "b.typ") {
          return '#include "a.typ"\n';
        }
        return undefined;
      }),
    ).toEqual(["a.typ", "b.typ"]);
  });
});

describe("outgoingTypstIncludes", () => {
  it("lists unique targets in first-occurrence order", () => {
    expect(
      outgoingTypstIncludes(
        '#include "layout.typ"\n#include "layout.typ"\n#include "kapitel/00.typ"\n',
        "main.typ",
      ),
    ).toEqual([
      { target: "layout.typ", path: "layout.typ" },
      { target: "kapitel/00.typ", path: "kapitel/00.typ" },
    ]);
  });
});

describe("incomingTypstIncludes", () => {
  it("lists other files whose includes resolve to the current file", () => {
    expect(
      incomingTypstIncludes("kapitel/00.typ", [
        {
          path: "main.typ",
          content: '#include "kapitel/00.typ"\n',
        },
        {
          path: "kapitel/00.typ",
          content: "self\n",
        },
        {
          path: "layout.typ",
          content: '= Layout\n',
        },
      ]),
    ).toEqual([
      {
        path: "main.typ",
        line: 1,
        text: '#include "kapitel/00.typ"',
        target: "kapitel/00.typ",
      },
    ]);
  });
});

describe("appendTypstInclude", () => {
  it("appends an include line for a new sibling file", () => {
    expect(appendTypstInclude('#include "layout.typ"\n', "main.typ", "Hello.typ")).toBe(
      '#include "layout.typ"\n#include "Hello.typ"\n',
    );
  });

  it("does not duplicate an include that already resolves to the file", () => {
    expect(
      appendTypstInclude('#include "./Hello.typ"\n', "main.typ", "Hello.typ"),
    ).toBe('#include "./Hello.typ"\n');
  });

  it("adds a newline before the include when the file has none", () => {
    expect(appendTypstInclude('#include "layout.typ"', "main.typ", "Hello.typ")).toBe(
      '#include "layout.typ"\n#include "Hello.typ"\n',
    );
  });
});

describe("relativeTypstIncludePath", () => {
  it("keeps a sibling path next to the main file", () => {
    expect(relativeTypstIncludePath("main.typ", "Hello.typ")).toBe("Hello.typ");
  });

  it("keeps a nested path from the project root", () => {
    expect(relativeTypstIncludePath("main.typ", "kapitel/00.typ")).toBe(
      "kapitel/00.typ",
    );
  });
});
