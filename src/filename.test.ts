import { describe, expect, it } from "vitest";
import {
  displayName,
  renamePath,
  untitledCreatePath,
} from "./filename";

describe("displayName", () => {
  it("shows Untitled when no file is open", () => {
    expect(displayName(null)).toBe("Untitled");
  });

  it("hides the .md extension", () => {
    expect(displayName("/vault/Hello.md")).toBe("Hello");
  });

  it("keeps non-md extensions visible", () => {
    expect(displayName("/vault/notes.txt")).toBe("notes.txt");
  });
});

describe("renamePath", () => {
  it("keeps a markdown file next to its current path", () => {
    expect(renamePath("/vault/Hello.md", "World")).toBe("/vault/World.md");
  });

  it("keeps a non-md extension when the typed name has none", () => {
    expect(renamePath("/vault/notes.txt", "draft")).toBe("/vault/draft.txt");
  });

  it("rejects empty or path-like names", () => {
    expect(renamePath("/vault/Hello.md", "")).toBeUndefined();
    expect(renamePath("/vault/Hello.md", "../escape")).toBeUndefined();
    expect(renamePath("/vault/Hello.md", "a/b")).toBeUndefined();
  });
});

describe("untitledCreatePath", () => {
  it("creates a markdown file in the project root", () => {
    expect(untitledCreatePath("/vault", "Hello")).toBe("/vault/Hello.md");
  });

  it("does not double a typed .md extension", () => {
    expect(untitledCreatePath("/vault", "Hello.md")).toBe("/vault/Hello.md");
  });
});
