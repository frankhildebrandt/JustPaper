import { describe, expect, it } from "vitest";
import { isCaseOnlyRename } from "./caseRename";

describe("isCaseOnlyRename", () => {
  it("is true when only letter case differs", () => {
    expect(isCaseOnlyRename("/p/note.md", "/p/Note.md")).toBe(true);
  });

  it("is false for identical or different paths", () => {
    expect(isCaseOnlyRename("/p/note.md", "/p/note.md")).toBe(false);
    expect(isCaseOnlyRename("/p/note.md", "/p/other.md")).toBe(false);
  });
});
