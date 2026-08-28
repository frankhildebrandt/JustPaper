import { describe, expect, it } from "vitest";
import { splitProjectPath } from "./linkHelper";

describe("splitProjectPath", () => {
  it("returns only a name for a top-level file", () => {
    expect(splitProjectPath("Hello.md")).toEqual({
      dir: "",
      name: "Hello.md",
    });
  });

  it("splits a nested path into directory and filename", () => {
    expect(splitProjectPath("Notes/Ideas/Hello.md")).toEqual({
      dir: "Notes/Ideas",
      name: "Hello.md",
    });
  });
});
