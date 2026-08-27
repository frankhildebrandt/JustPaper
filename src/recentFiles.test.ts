import { describe, expect, it } from "vitest";
import {
  forgetRecent,
  parseRecentFiles,
  recentFileLabels,
  rememberRecent,
  serializeRecentFiles,
} from "./recentFiles";

describe("rememberRecent", () => {
  it("puts the opened path first", () => {
    expect(rememberRecent(["/old.md"], "/new.md")).toEqual([
      "/new.md",
      "/old.md",
    ]);
  });

  it("moves an already listed path to the front without duplicating it", () => {
    expect(rememberRecent(["/a.md", "/b.md", "/c.md"], "/b.md")).toEqual([
      "/b.md",
      "/a.md",
      "/c.md",
    ]);
  });

  it("keeps only the nine most recent paths", () => {
    const paths = [
      "/1.md",
      "/2.md",
      "/3.md",
      "/4.md",
      "/5.md",
      "/6.md",
      "/7.md",
      "/8.md",
      "/9.md",
    ];

    expect(rememberRecent(paths, "/0.md")).toEqual([
      "/0.md",
      "/1.md",
      "/2.md",
      "/3.md",
      "/4.md",
      "/5.md",
      "/6.md",
      "/7.md",
      "/8.md",
    ]);
  });
});

describe("forgetRecent", () => {
  it("drops a missing file from the list", () => {
    expect(forgetRecent(["/a.md", "/gone.md", "/c.md"], "/gone.md")).toEqual([
      "/a.md",
      "/c.md",
    ]);
  });
});

describe("parseRecentFiles", () => {
  it("returns no paths when nothing was stored", () => {
    expect(parseRecentFiles(null)).toEqual([]);
  });

  it("reads a stored list of paths", () => {
    expect(parseRecentFiles('["/a.md","/b.md"]')).toEqual(["/a.md", "/b.md"]);
  });

  it("returns no paths when storage is corrupt", () => {
    expect(parseRecentFiles("not-json")).toEqual([]);
    expect(parseRecentFiles('{"path":"/a.md"}')).toEqual([]);
  });
});

describe("serializeRecentFiles", () => {
  it("round-trips through parseRecentFiles", () => {
    const paths = ["/a.md", "/b.md"];
    expect(parseRecentFiles(serializeRecentFiles(paths))).toEqual(paths);
  });
});

describe("recentFileLabels", () => {
  it("uses the file name when every name is unique", () => {
    expect(
      recentFileLabels([
        "/Users/frank/Projects/notes.md",
        "/Users/frank/Documents/letter.md",
      ]),
    ).toEqual(["notes.md", "letter.md"]);
  });

  it("adds the parent folder when two files share a name", () => {
    expect(
      recentFileLabels([
        "/Users/frank/Projects/notes.md",
        "/Users/frank/Documents/notes.md",
      ]),
    ).toEqual(["notes.md — Projects", "notes.md — Documents"]);
  });
});
