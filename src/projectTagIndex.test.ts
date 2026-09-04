import { describe, expect, it } from "vitest";
import { bindProjectTagIndex } from "./projectTagIndex";

describe("bindProjectTagIndex", () => {
  it("indexes notes after follow", async () => {
    const index = bindProjectTagIndex({
      readNotes: async () => [
        { path: "Hello.md", content: "---\ntags: [inbox]\n---\n" },
      ],
      readFile: async () => null,
      startWatch: async () => () => {},
    });
    index.follow("/vault");
    await Promise.resolve();
    expect(index.tagsFor("Hello.md")).toEqual(["inbox"]);
  });

  it("drops a stale rebuild after a newer follow", async () => {
    let finishOld: ((notes: { path: string; content: string }[]) => void) | undefined;
    const index = bindProjectTagIndex({
      readNotes: (root) => {
        if (root === "/old") {
          return new Promise((resolve) => {
            finishOld = resolve;
          });
        }
        return Promise.resolve([
          { path: "New.md", content: "---\ntags: [fresh]\n---\n" },
        ]);
      },
      readFile: async () => null,
      startWatch: async () => () => {},
    });
    index.follow("/old");
    index.follow("/vault");
    await Promise.resolve();
    finishOld?.([{ path: "Old.md", content: "---\ntags: [stale]\n---\n" }]);
    await Promise.resolve();
    expect(index.tagsFor("Old.md")).toEqual([]);
    expect(index.tagsFor("New.md")).toEqual(["fresh"]);
  });

  it("updates one file from a watch event", async () => {
    let emit: ((paths: string[]) => void) | undefined;
    const index = bindProjectTagIndex({
      readNotes: async () => [
        { path: "Hello.md", content: "---\ntags: [old]\n---\n" },
      ],
      readFile: async (path) => {
        if (path === "/vault/Hello.md") {
          return "---\ntags: [live]\n---\n";
        }
        return null;
      },
      startWatch: async (_root, onEvent) => {
        emit = onEvent;
        return () => {};
      },
    });
    index.follow("/vault");
    await Promise.resolve();
    emit?.(["/vault/Hello.md"]);
    await Promise.resolve();
    expect(index.tagsFor("Hello.md")).toEqual(["live"]);
  });

  it("normalizes Windows watch paths relative to their project root", async () => {
    let emit: ((paths: string[]) => void) | undefined;
    const index = bindProjectTagIndex({
      readNotes: async () => [],
      readFile: async () => "---\ntags: [windows]\n---\n",
      startWatch: async (_root, onEvent) => {
        emit = onEvent;
        return () => {};
      },
    });
    index.follow("C:\\Vault");
    await Promise.resolve();
    emit?.(["c:\\vault\\Notes\\Hello.md"]);
    await Promise.resolve();
    expect(index.tagsFor("Notes/Hello.md")).toEqual(["windows"]);
  });

  it("removes tags when the watched file is gone", async () => {
    let emit: ((paths: string[]) => void) | undefined;
    const index = bindProjectTagIndex({
      readNotes: async () => [
        { path: "Hello.md", content: "---\ntags: [inbox]\n---\n" },
      ],
      readFile: async () => null,
      startWatch: async (_root, onEvent) => {
        emit = onEvent;
        return () => {};
      },
    });
    index.follow("/vault");
    await Promise.resolve();
    emit?.(["/vault/Hello.md"]);
    await Promise.resolve();
    expect(index.tagsFor("Hello.md")).toEqual([]);
  });

  it("ignores watch paths outside a restricted file set", async () => {
    let emit: ((paths: string[]) => void) | undefined;
    const index = bindProjectTagIndex({
      readNotes: async () => [
        { path: "Paper.typ", content: "= Title\n" },
      ],
      readFile: async () => "---\ntags: [nope]\n---\n",
      startWatch: async (_root, onEvent) => {
        emit = onEvent;
        return () => {};
      },
    });
    index.follow("/vault", ["Paper.typ"]);
    await Promise.resolve();
    emit?.(["/vault/Hello.md"]);
    await Promise.resolve();
    expect(index.tagsFor("Hello.md")).toEqual([]);
  });

  it("keeps a live setFile across a rebuild of the same generation", async () => {
    let finishNotes:
      | ((notes: { path: string; content: string }[]) => void)
      | undefined;
    const index = bindProjectTagIndex({
      readNotes: () =>
        new Promise((resolve) => {
          finishNotes = resolve;
        }),
      readFile: async () => null,
      startWatch: async () => () => {},
    });
    index.follow("/vault");
    index.setFile("Hello.md", "---\ntags: [live]\n---\n");
    finishNotes?.([{ path: "Hello.md", content: "---\ntags: [stale]\n---\n" }]);
    await Promise.resolve();
    expect(index.tagsFor("Hello.md")).toEqual(["live"]);
  });
});
