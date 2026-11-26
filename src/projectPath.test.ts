import { describe, expect, it } from "vitest";
import {
  isSafeProjectRelative,
  isUnderRoot,
  joinRoot,
  parentDir,
  relativeFromRoot,
} from "./projectPath";

describe("relativeFromRoot", () => {
  it("returns POSIX paths relative to the root", () => {
    expect(relativeFromRoot("/p/", "/p/sub/a.md")).toBe("sub/a.md");
  });

  it("handles Windows separators and drive-letter case", () => {
    expect(relativeFromRoot("C:\\Notes", "c:\\Notes\\sub\\a.md")).toBe("sub/a.md");
  });

  it("rejects paths outside the root and sibling prefixes", () => {
    expect(relativeFromRoot("/p", "/other/a.md")).toBeUndefined();
    expect(relativeFromRoot("/p", "/p2/a.md")).toBeUndefined();
  });
});

describe("isUnderRoot", () => {
  it("accepts the root itself and its children", () => {
    expect(isUnderRoot("/p", "/p/")).toBe(true);
    expect(isUnderRoot("/p/a.md", "/p")).toBe(true);
  });

  it("rejects sibling prefixes", () => {
    expect(isUnderRoot("/p2/a.md", "/p")).toBe(false);
  });
});

describe("joinRoot", () => {
  it("joins with a single slash", () => {
    expect(joinRoot("C:\\p\\", "/a.md")).toBe("C:/p/a.md");
  });
});

describe("parentDir", () => {
  it("returns the folder or undefined at the top", () => {
    expect(parentDir("/p/sub/a.md")).toBe("/p/sub");
    expect(parentDir("/a.md")).toBeUndefined();
  });
});

describe("isSafeProjectRelative", () => {
  it("accepts nested paths that stay inside", () => {
    expect(isSafeProjectRelative("a/../b.md")).toBe(true);
  });

  it("rejects absolute, empty and escaping paths", () => {
    expect(isSafeProjectRelative("/etc/passwd")).toBe(false);
    expect(isSafeProjectRelative("C:/x.md")).toBe(false);
    expect(isSafeProjectRelative("")).toBe(false);
    expect(isSafeProjectRelative("../x.md")).toBe(false);
    expect(isSafeProjectRelative("a/../../x.md")).toBe(false);
  });
});
