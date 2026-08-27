import { describe, expect, it } from "vitest";
import {
  parseWikiLink,
  resolveWikiLink,
  wikiCreatePath,
  wikiLinkAt,
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
  });

  it("picks the shortest path when several basenames match", () => {
    expect(resolveWikiLink("A", ["deep/nested/A.md", "A.md", "other/A.md"])).toBe(
      "A.md",
    );
  });

  it("matches case-insensitively", () => {
    expect(resolveWikiLink("hello", files)).toBe("Hello.md");
  });

  it("returns undefined when nothing matches", () => {
    expect(resolveWikiLink("Missing", files)).toBeUndefined();
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
});
