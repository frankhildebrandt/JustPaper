import { describe, expect, it } from "vitest";
import type { DocumentBinding } from "./document";
import type { PaletteBinding, PaletteOpenOptions } from "./palette";
import type { ParserModeBinding } from "./parserMode";
import {
  bindProjectCommands,
  lineHitItem,
  NO_PROJECT_TEXT,
  parseLineHitId,
} from "./projectCommands";

function fakePalette(): { palette: PaletteBinding; last: () => PaletteOpenOptions } {
  let opened: PaletteOpenOptions | undefined;
  const palette = {
    open: (options: PaletteOpenOptions) => {
      opened = options;
    },
  } as unknown as PaletteBinding;
  return {
    palette,
    last: () => {
      if (!opened) {
        throw new Error("palette was not opened");
      }
      return opened;
    },
  };
}

function fakeDoc(overrides: Partial<DocumentBinding>): DocumentBinding {
  return {
    projectRoot: () => "/p",
    path: () => "/p/b/index.md",
    typstMain: () => null,
    listFiles: async () => [],
    listAssets: async () => [],
    tagsFor: () => [],
    ...overrides,
  } as DocumentBinding;
}

const parser = (text: string): ParserModeBinding =>
  ({ getDocument: () => text }) as unknown as ParserModeBinding;

describe("line hit ids", () => {
  it("round-trips paths that contain colons", () => {
    const item = lineHitItem({ path: "a:b.md", line: 7, text: "  hi " });
    expect(item).toEqual({ id: "a:b.md:7", title: "a:b.md:7", detail: "hi" });
    expect(parseLineHitId(item.id)).toEqual({ path: "a:b.md", line: 7 });
  });
});

describe("bindProjectCommands", () => {
  it("shows a hint instead of doing nothing outside a project", async () => {
    const { palette, last } = fakePalette();
    const commands = bindProjectCommands(
      fakeDoc({ projectRoot: () => null }),
      parser(""),
      palette,
    );
    commands.quickOpen();
    expect(last().emptyText).toBe(NO_PROJECT_TEXT);
    expect(await last().load("")).toEqual([]);
  });

  it("surfaces listing failures through the palette instead of swallowing them", async () => {
    const { palette, last } = fakePalette();
    const commands = bindProjectCommands(
      fakeDoc({ listFiles: () => Promise.reject(new Error("too many files")) }),
      parser(""),
      palette,
    );
    commands.quickOpen();
    await expect(last().load("x")).rejects.toThrow("too many files");
  });

  it("resolves outgoing links relative to the open note's folder", async () => {
    const { palette, last } = fakePalette();
    const commands = bindProjectCommands(
      fakeDoc({ listFiles: async () => ["a/todo.md", "b/todo.md"] }),
      parser("see [[todo]]"),
      palette,
    );
    commands.jumpOutgoing();
    const items = await last().load("");
    expect(items.map((item) => item.detail)).toEqual(["b/todo.md"]);
  });
});
