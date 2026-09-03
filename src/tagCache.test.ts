import { describe, expect, it } from "vitest";
import { createTagCache } from "./tagCache";

describe("createTagCache", () => {
  it("returns no tags for a path that has not been indexed", () => {
    const cache = createTagCache();
    expect(cache.tagsFor("Hello.md")).toEqual([]);
  });

  it("indexes tags from a full replace", () => {
    const cache = createTagCache();
    cache.replaceAll([
      { path: "Hello.md", content: "---\ntags:\n  - inbox\n---\n" },
      { path: "Note.md", content: "# no fence\n" },
    ]);
    expect(cache.tagsFor("Hello.md")).toEqual(["inbox"]);
    expect(cache.tagsFor("Note.md")).toEqual([]);
  });

  it("updates one file from later content", () => {
    const cache = createTagCache();
    cache.replaceAll([
      { path: "Hello.md", content: "---\ntags: [old]\n---\n" },
    ]);
    cache.setFile("Hello.md", "---\ntags: [new]\n---\n");
    expect(cache.tagsFor("Hello.md")).toEqual(["new"]);
  });

  it("drops a file when setFile receives null", () => {
    const cache = createTagCache();
    cache.setFile("Hello.md", "---\ntags: [inbox]\n---\n");
    cache.setFile("Hello.md", null);
    expect(cache.tagsFor("Hello.md")).toEqual([]);
  });

  it("keeps a newer setFile when a stale replaceAll arrives", () => {
    const cache = createTagCache();
    const generation = cache.beginRebuild();
    cache.setFile("Hello.md", "---\ntags: [live]\n---\n");
    cache.replaceAll(
      [{ path: "Hello.md", content: "---\ntags: [stale]\n---\n" }],
      generation,
    );
    expect(cache.tagsFor("Hello.md")).toEqual(["live"]);
  });

  it("ignores a replaceAll from an older rebuild generation", () => {
    const cache = createTagCache();
    const stale = cache.beginRebuild();
    cache.beginRebuild();
    cache.replaceAll(
      [{ path: "Hello.md", content: "---\ntags: [stale]\n---\n" }],
      stale,
    );
    expect(cache.tagsFor("Hello.md")).toEqual([]);
  });

  it("clears every entry", () => {
    const cache = createTagCache();
    cache.setFile("Hello.md", "---\ntags: [inbox]\n---\n");
    cache.clear();
    expect(cache.tagsFor("Hello.md")).toEqual([]);
  });
});
