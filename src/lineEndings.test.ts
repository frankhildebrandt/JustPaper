import { describe, expect, it } from "vitest";
import { detectLineEnding, toLf, withLineEnding } from "./lineEndings";

describe("detectLineEnding", () => {
  it("detects CRLF files", () => {
    expect(detectLineEnding("a\r\nb\r\n")).toBe("\r\n");
  });

  it("defaults to LF for LF and single-line text", () => {
    expect(detectLineEnding("a\nb")).toBe("\n");
    expect(detectLineEnding("single")).toBe("\n");
  });
});

describe("toLf", () => {
  it("normalises CRLF and lone CR to LF", () => {
    expect(toLf("a\r\nb\rc\n")).toBe("a\nb\nc\n");
  });
});

describe("withLineEnding", () => {
  it("restores CRLF on save", () => {
    expect(withLineEnding("a\nb\n", "\r\n")).toBe("a\r\nb\r\n");
  });

  it("leaves LF text untouched", () => {
    expect(withLineEnding("a\nb", "\n")).toBe("a\nb");
  });
});
