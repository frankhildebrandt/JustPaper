import { describe, expect, it } from "vitest";
import { documentDir, resolveImageSrc } from "./imageSrc";

describe("resolveImageSrc", () => {
  it("keeps http and https URLs only when external images are allowed", () => {
    expect(resolveImageSrc("https://example.com/a.png", "/notes", true)).toBe(
      "https://example.com/a.png",
    );
    expect(resolveImageSrc("http://example.com/a.png", null, true)).toBe(
      "http://example.com/a.png",
    );
  });

  it("rejects http and https URLs when external images are not allowed", () => {
    expect(
      resolveImageSrc("https://example.com/a.png", "/notes", false),
    ).toBeUndefined();
    expect(resolveImageSrc("http://example.com/a.png", null)).toBeUndefined();
  });

  it("joins a relative path to the document directory", () => {
    expect(resolveImageSrc("pic.png", "/Users/frank/Notes")).toBe(
      "/Users/frank/Notes/pic.png",
    );
    expect(resolveImageSrc("../img/a.png", "/Users/frank/Notes/sub")).toBe(
      "/Users/frank/Notes/img/a.png",
    );
  });

  it("rejects javascript URLs, empty hrefs, and relative paths without a base", () => {
    expect(resolveImageSrc("javascript:alert(1)", "/notes")).toBeUndefined();
    expect(resolveImageSrc("", "/notes")).toBeUndefined();
    expect(resolveImageSrc("pic.png", null)).toBeUndefined();
  });
});

describe("documentDir", () => {
  it("returns the parent folder of a saved note", () => {
    expect(documentDir("/Users/frank/Notes/hi.md")).toBe("/Users/frank/Notes");
    expect(documentDir(null)).toBeNull();
  });
});
