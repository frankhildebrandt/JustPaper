import { describe, expect, it } from "vitest";
import {
  incomingWikiLinks,
  isWikiAssetTarget,
  outgoingWikiLinks,
  parseWikiLink,
  resolveWikiLink,
  wikiCreatePath,
  wikiLinkAt,
  wikiLinksIn,
} from "./wikiLink";

describe("parseWikiLink", () => {
  it("reads a target from double brackets", () => {
    expect(parseWikiLink("[[Note]]", 0)).toEqual({
      target: "Note",
      alias: undefined,
      from: 0,
      to: 8,
    });
  });

  it("reads an alias after a pipe", () => {
    expect(parseWikiLink("see [[Note|shown]] here", 4)).toEqual({
      target: "Note",
      alias: "shown",
      from: 4,
      to: 18,
    });
  });

  it("rejects an unclosed link", () => {
    expect(parseWikiLink("[[Note", 0)).toBeUndefined();
  });

  it("does not rescan nested openers as one malformed link", () => {
    expect(parseWikiLink("[[broken [[valid]]", 0)).toBeUndefined();
    expect(wikiLinksIn("[[broken [[valid]]")).toEqual([
      { target: "valid", alias: undefined, from: 9, to: 18 },
    ]);
  });

  it("handles long runs of unmatched openers", () => {
    const source = "[[".repeat(500_000);
    const started = performance.now();
    expect(wikiLinksIn(source)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("wikiLinkAt", () => {
  it("finds the link that contains the caret", () => {
    expect(wikiLinkAt("see [[Note]] here", 6)?.target).toBe("Note");
  });

  it("returns undefined when the caret is outside any link", () => {
    expect(wikiLinkAt("see [[Note]] here", 0)).toBeUndefined();
  });
});

describe("resolveWikiLink", () => {
  const files = ["Hello.md", "folder/Note.md", "dup/A.md", "other/A.md"];

  it("matches a unique basename without extension", () => {
    expect(resolveWikiLink("Hello", files)).toBe("Hello.md");
  });

  it("matches a path relative to the project root", () => {
    expect(resolveWikiLink("folder/Note", files)).toBe("folder/Note.md");
    expect(resolveWikiLink("folder\\Note", files)).toBe("folder/Note.md");
  });

  it("picks the shortest path when several basenames match", () => {
    expect(resolveWikiLink("A", ["deep/nested/A.md", "A.md", "other/A.md"])).toBe(
      "A.md",
    );
  });

  it("matches case-insensitively", () => {
    expect(resolveWikiLink("hello", files)).toBe("Hello.md");
  });

  it("matches a typst note without extension", () => {
    expect(resolveWikiLink("Paper", ["Paper.typ", "Hello.md"])).toBe(
      "Paper.typ",
    );
  });

  it("returns undefined when nothing matches", () => {
    expect(resolveWikiLink("Missing", files)).toBeUndefined();
  });

  it("matches a PDF by its file name", () => {
    expect(
      resolveWikiLink("scan.pdf", ["Hello.md"], ["scan.pdf", "photo.png"]),
    ).toBe("scan.pdf");
  });

  it("matches an extensionless target to a PDF when no note exists", () => {
    expect(resolveWikiLink("scan", ["Hello.md"], ["scan.pdf"])).toBe("scan.pdf");
  });

  it("prefers a note over an attachment with the same stem", () => {
    expect(
      resolveWikiLink("scan", ["scan.md"], ["scan.pdf"]),
    ).toBe("scan.md");
  });
});

describe("wikiCreatePath", () => {
  it("creates a nested path under the project root", () => {
    expect(wikiCreatePath("folder/Note", "/vault", "/vault/Hello.md")).toBe(
      "/vault/folder/Note.md",
    );
  });

  it("creates beside the current file when the target has no slash", () => {
    expect(wikiCreatePath("Note", "/vault", "/vault/sub/Hello.md")).toBe(
      "/vault/sub/Note.md",
    );
  });

  it("falls back to the project root when no file is open", () => {
    expect(wikiCreatePath("Note", "/vault", null)).toBe("/vault/Note.md");
  });

  it("falls back to the project root when the open file is elsewhere", () => {
    expect(wikiCreatePath("Note", "/vault", "/outside/Hello.md")).toBe(
      "/vault/Note.md",
    );
  });

  it("keeps a non-note extension instead of appending .md", () => {
    expect(wikiCreatePath("scan.pdf", "/vault", "/vault/Hello.md")).toBe(
      "/vault/scan.pdf",
    );
  });

  it("normalizes safe dot segments inside the project", () => {
    expect(wikiCreatePath("folder/../Note", "/vault", "/vault/Hello.md")).toBe(
      "/vault/Note.md",
    );
    expect(wikiCreatePath("folder\\Note", "C:\\vault", "C:\\vault\\Hello.md")).toBe(
      "C:/vault/folder/Note.md",
    );
  });

  it("rejects traversal and absolute targets", () => {
    expect(wikiCreatePath("../outside", "/vault", "/vault/Hello.md")).toBeUndefined();
    expect(wikiCreatePath("..\\outside", "/vault", "/vault/Hello.md")).toBeUndefined();
    expect(wikiCreatePath("folder/../../outside", "/vault", null)).toBeUndefined();
    expect(wikiCreatePath("/outside", "/vault", null)).toBeUndefined();
    expect(wikiCreatePath("C:\\outside", "C:\\vault", null)).toBeUndefined();
    expect(wikiCreatePath("C:outside", "C:\\vault", null)).toBeUndefined();
  });
});

describe("outgoingWikiLinks", () => {
  const files = ["Hello.md", "folder/Note.md"];

  it("lists unique targets in first-occurrence order", () => {
    expect(
      outgoingWikiLinks("see [[Hello]] and [[Hello|again]] then [[Note]]", files),
    ).toEqual([
      { target: "Hello", alias: undefined, path: "Hello.md" },
      { target: "Note", alias: undefined, path: "folder/Note.md" },
    ]);
  });

  it("keeps the alias from the first occurrence", () => {
    expect(outgoingWikiLinks("[[Hello|shown]] then [[Hello]]", files)).toEqual([
      { target: "Hello", alias: "shown", path: "Hello.md" },
    ]);
  });

  it("leaves path undefined when the target does not resolve", () => {
    expect(outgoingWikiLinks("[[Missing]]", files)).toEqual([
      { target: "Missing", alias: undefined, path: undefined },
    ]);
  });

  it("resolves a PDF against the asset list", () => {
    expect(
      outgoingWikiLinks("[[scan.pdf]]", files, ["scan.pdf"]),
    ).toEqual([
      { target: "scan.pdf", alias: undefined, path: "scan.pdf" },
    ]);
  });
});

describe("incomingWikiLinks", () => {
  const files = ["Hello.md", "folder/Note.md", "Other.md"];

  it("lists other notes whose wiki links resolve to the current file", () => {
    expect(
      incomingWikiLinks("Hello.md", [
        { path: "Hello.md", content: "self [[Hello]]" },
        { path: "Other.md", content: "see [[Hello]] here" },
        { path: "folder/Note.md", content: "intro\n[[Hello|shown]]\nend" },
      ], files),
    ).toEqual([
      {
        path: "Other.md",
        line: 1,
        text: "see [[Hello]] here",
        target: "Hello",
      },
      {
        path: "folder/Note.md",
        line: 2,
        text: "[[Hello|shown]]",
        target: "Hello",
      },
    ]);
  });

  it("ignores links that resolve to a different file", () => {
    expect(
      incomingWikiLinks("Hello.md", [
        { path: "Other.md", content: "[[Note]]" },
      ], files),
    ).toEqual([]);
  });
});

describe("dotted wiki targets", () => {
  it("treats version and date names as notes, not assets", () => {
    expect(isWikiAssetTarget("v1.2")).toBe(false);
    expect(isWikiAssetTarget("Meeting 2024.05.01")).toBe(false);
    expect(isWikiAssetTarget("Dr. Smith")).toBe(false);
    expect(isWikiAssetTarget("scan.pdf")).toBe(true);
  });

  it("creates markdown notes for dotted names", () => {
    expect(wikiCreatePath("v1.2", "/vault", null)).toBe("/vault/v1.2.md");
    expect(wikiCreatePath("Meeting 2024.05.01", "/vault", null)).toBe(
      "/vault/Meeting 2024.05.01.md",
    );
    expect(wikiCreatePath("scan.pdf", "/vault", null)).toBe("/vault/scan.pdf");
  });

  it("resolves a dotted note name and does not strip its last segment", () => {
    expect(resolveWikiLink("v1.2", ["v1.2.md"])).toBe("v1.2.md");
    expect(resolveWikiLink("v1.2", [], ["v1.pdf"])).toBeUndefined();
  });
});

describe("resolveWikiLink from a note", () => {
  const files = ["A.md", "projects/x/A.md", "projects/x/Note.md"];

  it("prefers a same-folder match over a shorter path", () => {
    expect(resolveWikiLink("A", files, [], "projects/x/Note.md")).toBe(
      "projects/x/A.md",
    );
  });

  it("falls back to the shortest path without a same-folder match", () => {
    expect(resolveWikiLink("A", files, [], "other/Note.md")).toBe("A.md");
    expect(resolveWikiLink("A", files)).toBe("A.md");
  });

  it("uses the linking note's folder for incoming links", () => {
    expect(
      incomingWikiLinks(
        "projects/x/A.md",
        [
          { path: "projects/x/Note.md", content: "[[A]]" },
          { path: "Root.md", content: "[[A]]" },
        ],
        files,
      ).map((hit) => hit.path),
    ).toEqual(["projects/x/Note.md"]);
  });

  it("uses the current note's folder for outgoing links", () => {
    expect(
      outgoingWikiLinks("[[A]]", files, [], "projects/x/Note.md")[0]?.path,
    ).toBe("projects/x/A.md");
  });
});

describe("wiki links in code", () => {
  it("ignores links inside inline code spans", () => {
    expect(wikiLinksIn("`[[Hidden]]` and [[Shown]]").map((l) => l.target)).toEqual([
      "Shown",
    ]);
  });

  it("ignores links inside double-backtick spans", () => {
    expect(wikiLinksIn("``a ` [[Hidden]]`` [[Shown]]").map((l) => l.target)).toEqual([
      "Shown",
    ]);
  });

  it("ignores links inside fenced code blocks", () => {
    const source = "[[One]]\n```\n[[Hidden]]\n```\n[[Two]]";
    expect(wikiLinksIn(source).map((l) => l.target)).toEqual(["One", "Two"]);
  });

  it("keeps links after an unmatched backtick", () => {
    expect(wikiLinksIn("a ` b [[Shown]]").map((l) => l.target)).toEqual([
      "Shown",
    ]);
  });

  it("does not report a code link at the caret", () => {
    expect(wikiLinkAt("`[[Hidden]]`", 4)).toBeUndefined();
  });

  it("skips code links for incoming links", () => {
    expect(
      incomingWikiLinks(
        "A.md",
        [{ path: "B.md", content: "```\n[[A]]\n```" }],
        ["A.md", "B.md"],
      ),
    ).toEqual([]);
  });
});
