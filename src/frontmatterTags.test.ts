import { describe, expect, it } from "vitest";
import { extractFrontmatterTags } from "./frontmatterTags";

describe("extractFrontmatterTags", () => {
  it("returns no tags when the document has no frontmatter fence", () => {
    expect(extractFrontmatterTags("# Title\n")).toEqual([]);
  });

  it("returns no tags when the opening fence is unclosed", () => {
    expect(extractFrontmatterTags("---\ntags:\n  - work\n")).toEqual([]);
  });

  it("reads a block list under tags", () => {
    expect(
      extractFrontmatterTags("---\ntags:\n  - work\n  - project/foo\n---\n"),
    ).toEqual(["work", "project/foo"]);
  });

  it("reads an inline flow sequence", () => {
    expect(extractFrontmatterTags("---\ntags: [work, project]\n---\n")).toEqual([
      "work",
      "project",
    ]);
  });

  it("reads a scalar tag value", () => {
    expect(extractFrontmatterTags("---\ntags: work\n---\n")).toEqual(["work"]);
  });

  it("reads the singular tag key", () => {
    expect(extractFrontmatterTags("---\ntag: inbox\n---\n")).toEqual(["inbox"]);
  });

  it("strips quotes and a leading hash", () => {
    expect(
      extractFrontmatterTags("---\ntags:\n  - \"#inbox\"\n  - '#draft'\n---\n"),
    ).toEqual(["inbox", "draft"]);
  });

  it("keeps first-seen order and drops duplicates", () => {
    expect(
      extractFrontmatterTags("---\ntags: [work, inbox, work]\n---\n"),
    ).toEqual(["work", "inbox"]);
  });

  it("ignores nested tags keys", () => {
    expect(
      extractFrontmatterTags(
        "---\nmeta:\n  tags:\n    - nested\ntags:\n  - top\n---\n",
      ),
    ).toEqual(["top"]);
  });
});
