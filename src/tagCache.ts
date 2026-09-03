import { extractFrontmatterTags } from "./frontmatterTags";

export type TagNote = {
  path: string;
  content: string;
};

export type TagCache = {
  tagsFor: (path: string) => string[];
  setFile: (path: string, content: string | null) => void;
  beginRebuild: () => number;
  replaceAll: (notes: readonly TagNote[], generation?: number) => void;
  clear: () => void;
};

/**
 * Holds path → tags, so a background rebuild cannot clobber a newer setFile.
 */
export function createTagCache(): TagCache {
  const tags = new Map<string, string[]>();
  const dirty = new Set<string>();
  let generation = 0;

  const write = (path: string, content: string): void => {
    tags.set(path, extractFrontmatterTags(content));
  };

  return {
    tagsFor: (path: string): string[] => tags.get(path) ?? [],
    setFile: (path: string, content: string | null): void => {
      dirty.add(path);
      if (content === null) {
        tags.delete(path);
        return;
      }
      write(path, content);
    },
    beginRebuild: (): number => {
      generation += 1;
      dirty.clear();
      return generation;
    },
    replaceAll: (notes: readonly TagNote[], rebuildGeneration?: number): void => {
      if (
        rebuildGeneration !== undefined &&
        rebuildGeneration !== generation
      ) {
        return;
      }
      if (rebuildGeneration === undefined) {
        dirty.clear();
        tags.clear();
        for (const note of notes) {
          write(note.path, note.content);
        }
        return;
      }
      const keep = new Set<string>();
      for (const note of notes) {
        keep.add(note.path);
        if (dirty.has(note.path)) {
          continue;
        }
        write(note.path, note.content);
      }
      for (const path of [...tags.keys()]) {
        if (!keep.has(path) && !dirty.has(path)) {
          tags.delete(path);
        }
      }
    },
    clear: (): void => {
      generation += 1;
      dirty.clear();
      tags.clear();
    },
  };
}
