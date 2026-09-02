import { describe, expect, it } from "vitest";
import {
  caretFor,
  clampCaretOffset,
  parseStoredSession,
  pruneCarets,
  rememberCaret,
  renameCaret,
  serializeStoredSession,
} from "./storedSession";

describe("parseStoredSession", () => {
  it("reads the last file, project root, and per-file carets", () => {
    expect(
      parseStoredSession(
        JSON.stringify({
          root: "/vault",
          lastFile: "/vault/Hello.md",
          carets: { "/vault/Hello.md": 12, "/vault/Note.md": 3 },
        }),
      ),
    ).toEqual({
      root: "/vault",
      lastFile: "/vault/Hello.md",
      carets: { "/vault/Hello.md": 12, "/vault/Note.md": 3 },
      typstMain: null,
    });
  });

  it("promotes a legacy caretOffset onto the last file", () => {
    expect(
      parseStoredSession(
        JSON.stringify({
          root: "/vault",
          lastFile: "/vault/Hello.md",
          caretOffset: 9,
        }),
      ),
    ).toEqual({
      root: "/vault",
      lastFile: "/vault/Hello.md",
      carets: { "/vault/Hello.md": 9 },
      typstMain: null,
    });
  });

      it("reads a Typst main document", () => {
    expect(
      parseStoredSession(
        JSON.stringify({
          root: "/vault",
          lastFile: "/vault/kapitel/00.typ",
          carets: {},
          typstMain: "/vault/main.typ",
        }),
      ),
    ).toEqual({
      root: "/vault",
      lastFile: "/vault/kapitel/00.typ",
      carets: {},
      typstMain: "/vault/main.typ",
    });
  });

  it("ignores corrupt payloads", () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession("{")).toBeNull();
    expect(parseStoredSession(JSON.stringify({ lastFile: 1 }))).toBeNull();
  });
});

describe("rememberCaret", () => {
  it("stores the caret for a path", () => {
    expect(rememberCaret({}, "/vault/Hello.md", 4)).toEqual({
      "/vault/Hello.md": 4,
    });
  });
});

describe("caretFor", () => {
  it("returns 0 when no caret is stored", () => {
    expect(caretFor({}, "/vault/Hello.md")).toBe(0);
  });
});

describe("clampCaretOffset", () => {
  it("keeps the caret inside the document", () => {
    expect(clampCaretOffset(4, 10)).toBe(4);
    expect(clampCaretOffset(99, 10)).toBe(10);
    expect(clampCaretOffset(-2, 10)).toBe(0);
  });
});

describe("renameCaret", () => {
  it("moves the stored caret to the new path", () => {
    expect(
      renameCaret({ "/old.md": 5, "/other.md": 1 }, "/old.md", "/new.md"),
    ).toEqual({ "/new.md": 5, "/other.md": 1 });
  });
});

describe("pruneCarets", () => {
  it("keeps only the listed paths", () => {
    expect(
      pruneCarets({ "/a.md": 1, "/b.md": 2, "/c.md": 3 }, ["/a.md", "/c.md"]),
    ).toEqual({ "/a.md": 1, "/c.md": 3 });
  });
});

describe("serializeStoredSession", () => {
  it("round-trips a session snapshot", () => {
    const stored = {
      root: "/vault",
      lastFile: "/vault/Hello.md",
      carets: { "/vault/Hello.md": 7 },
      typstMain: "/vault/main.typ",
    };
    expect(parseStoredSession(serializeStoredSession(stored))).toEqual(stored);
  });

  it("round-trips an untitled session without a project", () => {
    const stored = { root: null, lastFile: null, carets: {}, typstMain: null };
    expect(parseStoredSession(serializeStoredSession(stored))).toEqual(stored);
  });
});
